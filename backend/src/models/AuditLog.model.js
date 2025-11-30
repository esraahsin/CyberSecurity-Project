/**
 * Model AuditLog - Gestion des logs d'audit
 * @module models/AuditLog.model
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class AuditLogModel {
  /**
   * CREATE - Crée un nouveau log d'audit
   */
  async create(logData) {
    const {
      userId = null,
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
      metadata = null,
      errorMessage = null
    } = logData;

    const query = `
      INSERT INTO audit_logs (
        user_id, session_id, action, resource_type, resource_id,
        event_type, severity, old_values, new_values,
        ip_address, user_agent, request_method, request_path,
        metadata, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, created_at
    `;

    const values = [
      userId,
      sessionId,
      action,
      resourceType,
      resourceId,
      eventType,
      severity,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      requestMethod,
      requestPath,
      metadata ? JSON.stringify(metadata) : null,
      errorMessage
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('AuditLog creation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * READ - Trouve les logs avec filtres
   */
  async findWithFilters(filters = {}, options = {}) {
    const {
      userId,
      action,
      eventType,
      severity,
      resourceType,
      startDate,
      endDate,
      isSuspicious
    } = filters;

    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

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

    if (isSuspicious !== undefined) {
      query += ` AND al.is_suspicious = $${paramIndex++}`;
      params.push(isSuspicious);
    }

    // Compter le total
    const countQuery = query.replace(
      'SELECT al.*, u.email, u.username',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Ajouter pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * READ - Logs par utilisateur
   */
  async findByUserId(userId, options = {}) {
    const { limit = 50, severity } = options;

    let query = `
      SELECT *
      FROM audit_logs
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * READ - Logs critiques récents
   */
  async findCriticalRecent(hours = 24, limit = 100) {
    const query = `
      SELECT 
        al.*,
        u.email, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.severity IN ('critical', 'error')
      AND al.created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY al.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * READ - Statistiques d'audit
   */
  async getStats(filters = {}) {
    const { startDate, endDate } = filters;

    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'error') as errors,
        COUNT(*) FILTER (WHERE severity = 'warning') as warnings,
        COUNT(*) FILTER (WHERE is_suspicious = true) as suspicious,
        COUNT(*) FILTER (WHERE event_type = 'security_event') as security_events,
        COUNT(*) FILTER (WHERE event_type = 'transaction') as transactions,
        COUNT(DISTINCT user_id) as unique_users
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
    return result.rows[0];
  }

  /**
   * DELETE - Nettoie les vieux logs
   */
  async cleanup(daysToKeep = 365) {
    const query = `
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      AND severity NOT IN ('critical', 'error')
      RETURNING COUNT(*) as count
    `;

    const result = await pool.query(query);
    const deletedCount = result.rowCount || 0;

    if (deletedCount > 0) {
      logger.info('Audit logs cleaned up', { count: deletedCount });
    }

    return deletedCount;
  }

  /**
   * Recherche dans les logs
   */
  async search(searchTerm, options = {}) {
    const { limit = 50 } = options;

    const query = `
      SELECT 
        al.*,
        u.email, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE (
        al.action ILIKE $1
        OR al.resource_type ILIKE $1
        OR al.error_message ILIKE $1
        OR u.email ILIKE $1
      )
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }
}

module.exports = new AuditLogModel();