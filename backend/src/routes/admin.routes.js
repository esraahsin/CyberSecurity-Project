/**
 * Routes d'administration
 * Réservées aux administrateurs uniquement
 * @module routes/admin.routes
 */

const express = require('express');
const router = express.Router();

// Middleware
const { 
  authenticateToken,
  requireRole 
} = require('../middleware/auth.middleware');

const { 
  sensitiveOperationRateLimiter 
} = require('../middleware/security.middleware');

const {
  validateIdParam,
  validatePagination,
  validateDateRange
} = require('../middleware/validation.middleware');

// Services
const auditService = require('../services/audit.service');
const userService = require('../services/user.service');
const pool = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// Toutes les routes admin nécessitent auth + rôle admin
// ============================================
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ============================================
// Dashboard & Statistics
// ============================================

/**
 * GET /api/admin/dashboard
 * Récupère les statistiques du dashboard admin
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    // Statistiques utilisateurs
    const usersStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week
      FROM users
    `);

    // Statistiques comptes
    const accountsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_accounts,
        SUM(balance) as total_balance,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_accounts
      FROM accounts
    `);

    // Statistiques transactions
    const transactionsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE fraud_score > 70) as high_risk
      FROM transactions
    `);

    // Logs critiques récents
    const criticalLogs = await auditService.getAuditLogs(
      { severity: 'critical' },
      { page: 1, limit: 10 }
    );

    res.json({
      success: true,
      data: {
        users: usersStats.rows[0],
        accounts: accountsStats.rows[0],
        transactions: transactionsStats.rows[0],
        criticalLogs: criticalLogs.logs
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'Admin Dashboard' });
    next(error);
  }
});

/**
 * GET /api/admin/stats
 * Statistiques détaillées
 */
router.get('/stats', validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const auditStats = await auditService.getAuditStats({ startDate, endDate });

    res.json({
      success: true,
      data: { audit: auditStats }
    });
  } catch (error) {
    logger.logError(error, { context: 'Admin Stats' });
    next(error);
  }
});

// ============================================
// Audit Logs Management
// ============================================

/**
 * GET /api/admin/audit-logs
 * Liste les logs d'audit avec filtres
 */
router.get('/audit-logs', validatePagination, async (req, res, next) => {
  try {
    const { 
      page, 
      limit, 
      userId, 
      action, 
      eventType, 
      severity,
      startDate,
      endDate 
    } = req.query;

    const result = await auditService.getAuditLogs(
      { userId, action, eventType, severity, startDate, endDate },
      { page, limit }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.logError(error, { context: 'Admin Audit Logs' });
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/critical
 * Logs critiques récents
 */
router.get('/audit-logs/critical', async (req, res, next) => {
  try {
    const result = await auditService.getAuditLogs(
      { severity: 'critical' },
      { page: 1, limit: 50 }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.logError(error, { context: 'Critical Logs' });
    next(error);
  }
});

/**
 * DELETE /api/admin/audit-logs/cleanup
 * Nettoie les vieux logs
 */
router.delete(
  '/audit-logs/cleanup',
  sensitiveOperationRateLimiter(),
  async (req, res, next) => {
    try {
      const { daysToKeep = 365 } = req.body;

      const deletedCount = await auditService.cleanupOldLogs(daysToKeep);

      // Log l'action
      await auditService.logAction({
        userId: req.user.id,
        action: 'CLEANUP_AUDIT_LOGS',
        resourceType: 'audit_log',
        eventType: 'system_event',
        severity: 'info',
        metadata: { deletedCount, daysToKeep },
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `${deletedCount} logs deleted`,
        data: { deletedCount }
      });
    } catch (error) {
      logger.logError(error, { context: 'Cleanup Logs' });
      next(error);
    }
  }
);

// ============================================
// System Management
// ============================================

/**
 * GET /api/admin/system/health
 * État de santé du système
 */
router.get('/system/health', async (req, res, next) => {
  try {
    // Test connexion DB
    const dbHealth = await pool.query('SELECT NOW()');
    
    // Test Redis (si utilisé)
    // const redisHealth = await redisClient.ping();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: {
          status: 'connected',
          timestamp: dbHealth.rows[0].now
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'System Health' });
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/system/maintenance
 * Active/désactive le mode maintenance
 */
router.post(
  '/system/maintenance',
  sensitiveOperationRateLimiter(),
  async (req, res, next) => {
    try {
      const { enabled, message } = req.body;

      // TODO: Implémenter le mode maintenance
      // (stocker dans Redis ou fichier de config)

      await auditService.logSecurityEvent({
        userId: req.user.id,
        event: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
        severity: 'high',
        details: { message },
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      logger.logError(error, { context: 'Maintenance Mode' });
      next(error);
    }
  }
);

/**
 * GET /api/admin/reports/daily
 * Rapport quotidien
 */
router.get('/reports/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const report = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_transactions,
        SUM(amount) as total_amount,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM transactions
      WHERE DATE(created_at) = $1
      GROUP BY DATE(created_at)
    `, [date]);

    res.json({
      success: true,
      data: report.rows[0] || { date, total_transactions: 0 }
    });
  } catch (error) {
    logger.logError(error, { context: 'Daily Report' });
    next(error);
  }
});

// ============================================
// Export routes
// ============================================
module.exports = router;