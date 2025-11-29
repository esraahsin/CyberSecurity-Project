/**
 * Service d'audit et de logging
 * Enregistre toutes les actions et événements de sécurité
 * @module services/audit.service
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Enregistre une action utilisateur
 * @param {Object} actionData - Données de l'action
 * @returns {Promise<Object>} Log d'audit créé
 */
const logAction = async (actionData) => {
  try {
    const {
      userId,
      sessionId = null,
      action,
      resourceType,
      resourceId = null,
      eventType = 'data_access',
      severity = 'info',
      oldValues = null,
      newValues = null,
      ipAddress = null,
      userAgent = null,
      requestMethod = null,
      requestPath = null,
      requestBody = null,
      responseStatus = null,
      metadata = null,
      errorMessage = null,
      executionTimeMs = null
    } = actionData;

    // Calcule les changements si oldValues et newValues existent
    let changes = null;
    if (oldValues && newValues) {
      changes = calculateChanges(oldValues, newValues);
    }

    const result = await pool.query(
      `INSERT INTO audit_logs (
        user_id, session_id, action, resource_type, resource_id,
        event_type, severity, old_values, new_values, changes,
        ip_address, user_agent, request_method, request_path,
        request_body, response_status, metadata, error_message,
        execution_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, created_at`,
      [
        userId, sessionId, action, resourceType, resourceId,
        eventType, severity,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        changes ? JSON.stringify(changes) : null,
        ipAddress, userAgent, requestMethod, requestPath,
        requestBody ? JSON.stringify(requestBody) : null,
        responseStatus,
        metadata ? JSON.stringify(metadata) : null,
        errorMessage, executionTimeMs
      ]
    );

    const auditLog = result.rows[0];

    // Log aussi dans Winston pour les logs critiques
    if (severity === 'critical' || severity === 'error') {
      logger.error('Audit log created', {
        auditId: auditLog.id,
        action,
        severity,
        userId
      });
    }

    return {
      id: auditLog.id,
      createdAt: auditLog.created_at
    };

  } catch (error) {
    logger.error('Audit log creation failed', { error: error.message });
    // Ne pas throw pour ne pas bloquer l'opération principale
    return null;
  }
};

/**
 * Enregistre un événement de sécurité
 * @param {Object} eventData - Données de l'événement
 * @returns {Promise<Object>} Log créé
 */
const logSecurityEvent = async (eventData) => {
  try {
    const {
      userId = null,
      event,
      severity = 'warning',
      details = {},
      ipAddress = null,
      userAgent = null,
      riskScore = null,
      riskFactors = []
    } = eventData;

    const result = await logAction({
      userId,
      action: event,
      resourceType: 'security',
      eventType: 'security_event',
      severity,
      metadata: details,
      ipAddress,
      userAgent,
      isSuspicious: severity === 'high' || severity === 'critical'
    });

    // Enregistre aussi le risk score si fourni
    if (riskScore !== null && result) {
      await pool.query(
        `UPDATE audit_logs 
         SET risk_score = $1, risk_factors = $2 
         WHERE id = $3`,
        [riskScore, riskFactors, result.id]
      );
    }

    // Log dans Winston pour événements critiques
    if (severity === 'critical' || severity === 'high') {
      logger.warn('Security event logged', {
        event,
        severity,
        userId,
        details
      });
    }

    return result;

  } catch (error) {
    logger.error('Security event logging failed', { error: error.message });
    return null;
  }
};

/**
 * Enregistre une transaction
 * @param {Object} transactionData - Données de transaction
 * @returns {Promise<Object>} Log créé
 */
const logTransaction = async (transactionData) => {
  try {
    const {
      userId,
      transactionId,
      fromAccount = null,
      toAccount = null,
      amount,
      type,
      status,
      ipAddress = null,
      metadata = {}
    } = transactionData;

    return await logAction({
      userId,
      action: 'TRANSACTION_' + type.toUpperCase(),
      resourceType: 'transaction',
      resourceId: transactionId,
      eventType: 'transaction',
      severity: amount > 10000 ? 'warning' : 'info',
      metadata: {
        ...metadata,
        fromAccount,
        toAccount,
        amount,
        type,
        status
      },
      ipAddress
    });

  } catch (error) {
    logger.error('Transaction logging failed', { error: error.message });
    return null;
  }
};

/**
 * Enregistre un changement de données sensibles
 * @param {Object} changeData - Données du changement
 * @returns {Promise<Object>} Log créé
 */
const logDataChange = async (changeData) => {
  try {
    const {
      userId,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress = null
    } = changeData;

    return await logAction({
      userId,
      action: 'UPDATE_' + resourceType.toUpperCase(),
      resourceType,
      resourceId,
      eventType: 'data_access',
      severity: 'info',
      oldValues,
      newValues,
      ipAddress
    });

  } catch (error) {
    logger.error('Data change logging failed', { error: error.message });
    return null;
  }
};

/**
 * Récupère les logs d'audit avec filtres
 * @param {Object} filters - Filtres de recherche
 * @param {Object} pagination - Pagination
 * @returns {Promise<Object>} Logs et métadonnées
 */
const getAuditLogs = async (filters = {}, pagination = {}) => {
  try {
    const {
      userId = null,
      action = null,
      eventType = null,
      severity = null,
      resourceType = null,
      startDate = null,
      endDate = null,
      isSuspicious = null
    } = filters;

    const {
      page = 1,
      limit = 50
    } = pagination;

    const offset = (page - 1) * limit;

    // Construction de la requête
    let query = `
      SELECT 
        al.*,
        u.email, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND al.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }

    if (eventType) {
      query += ` AND al.event_type = $${paramIndex++}`;
      params.push(eventType);
    }

    if (severity) {
      query += ` AND al.severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (resourceType) {
      query += ` AND al.resource_type = $${paramIndex++}`;
      params.push(resourceType);
    }

    if (startDate) {
      query += ` AND al.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (isSuspicious !== null) {
      query += ` AND al.is_suspicious = $${paramIndex++}`;
      params.push(isSuspicious);
    }

    // Compte total
    const countQuery = query.replace(
      'SELECT al.*, u.email, u.username',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Résultats paginés
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      logs: result.rows.map(log => ({
        id: log.id,
        userId: log.user_id,
        user: log.email ? {
          email: log.email,
          username: log.username
        } : null,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        eventType: log.event_type,
        severity: log.severity,
        oldValues: log.old_values,
        newValues: log.new_values,
        changes: log.changes,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        metadata: log.metadata,
        isSuspicious: log.is_suspicious,
        riskScore: log.risk_score,
        createdAt: log.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };

  } catch (error) {
    logger.error('Get audit logs failed', { error: error.message });
    throw new Error(`Failed to get audit logs: ${error.message}`);
  }
};

/**
 * Récupère les statistiques d'audit
 * @param {Object} filters - Filtres optionnels
 * @returns {Promise<Object>} Statistiques
 */
const getAuditStats = async (filters = {}) => {
  try {
    const { startDate = null, endDate = null } = filters;

    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'error') as errors,
        COUNT(*) FILTER (WHERE severity = 'warning') as warnings,
        COUNT(*) FILTER (WHERE is_suspicious = true) as suspicious,
        COUNT(*) FILTER (WHERE event_type = 'security_event') as security_events,
        COUNT(*) FILTER (WHERE event_type = 'transaction') as transactions
      FROM audit_logs
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    return {
      total: parseInt(stats.total),
      critical: parseInt(stats.critical),
      errors: parseInt(stats.errors),
      warnings: parseInt(stats.warnings),
      suspicious: parseInt(stats.suspicious),
      securityEvents: parseInt(stats.security_events),
      transactions: parseInt(stats.transactions)
    };

  } catch (error) {
    logger.error('Get audit stats failed', { error: error.message });
    throw new Error(`Failed to get audit stats: ${error.message}`);
  }
};

/**
 * Supprime les anciens logs d'audit
 * @param {number} daysToKeep - Jours à conserver
 * @returns {Promise<number>} Nombre de logs supprimés
 */
const cleanupOldLogs = async (daysToKeep = 365) => {
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs 
       WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
       AND severity NOT IN ('critical', 'error')`,
      []
    );

    if (result.rowCount > 0) {
      logger.info('Old audit logs cleaned up', { count: result.rowCount });
    }

    return result.rowCount;

  } catch (error) {
    logger.error('Cleanup old logs failed', { error: error.message });
    throw new Error(`Failed to cleanup old logs: ${error.message}`);
  }
};

/**
 * Calcule les différences entre deux objets
 * @param {Object} oldValues - Anciennes valeurs
 * @param {Object} newValues - Nouvelles valeurs
 * @returns {Object} Changements
 */
const calculateChanges = (oldValues, newValues) => {
  const changes = {};

  // Parcourt les nouvelles valeurs
  for (const key in newValues) {
    if (oldValues[key] !== newValues[key]) {
      changes[key] = {
        from: oldValues[key],
        to: newValues[key]
      };
    }
  }

  // Vérifie les clés supprimées
  for (const key in oldValues) {
    if (!(key in newValues)) {
      changes[key] = {
        from: oldValues[key],
        to: null
      };
    }
  }

  return changes;
};

module.exports = {
  logAction,
  logSecurityEvent,
  logTransaction,
  logDataChange,
  getAuditLogs,
  getAuditStats,
  cleanupOldLogs
};