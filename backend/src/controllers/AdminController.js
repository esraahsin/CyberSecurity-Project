const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { sensitiveOperationRateLimiter } = require('../middleware/security.middleware');
const { validateIdParam, validatePagination, validateDateRange } = require('../middleware/validation.middleware');

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const usersStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week
      FROM users
    `);

    const accountsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_accounts,
        SUM(balance) as total_balance,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_accounts
      FROM accounts
    `);

    const transactionsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE fraud_score > 70) as high_risk
      FROM transactions
    `);

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

// GET /api/admin/stats
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

// GET /api/admin/audit-logs
router.get('/audit-logs', validatePagination, async (req, res, next) => {
  try {
    const { page, limit, userId, action, eventType, severity, startDate, endDate } = req.query;

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

// GET /api/admin/system/health
router.get('/system/health', async (req, res, next) => {
  try {
    const dbHealth = await pool.query('SELECT NOW()');
    
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

module.exports = router;