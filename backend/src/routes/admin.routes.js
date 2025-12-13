// backend/src/routes/admin.routes.js - FIXED VERSION
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

// GET /api/admin/dashboard - FIXED VERSION
router.get('/dashboard', async (req, res, next) => {
  try {
    console.log('📊 Admin Dashboard: Fetching users stats...');
    
    // Users stats
    const usersStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week
      FROM users
    `);
    console.log('✅ Users stats:', usersStats.rows[0]);

    console.log('📊 Admin Dashboard: Fetching accounts stats...');
    
    // Accounts stats - FIXED: Handle NULL balance
    const accountsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_accounts,
        COALESCE(SUM(balance), 0) as total_balance,
        COUNT(*) FILTER (WHERE account_status = 'active') as active_accounts
      FROM accounts
    `);
    console.log('✅ Accounts stats:', accountsStats.rows[0]);

    console.log('📊 Admin Dashboard: Fetching transactions stats...');
    
    // Transactions stats
    const transactionsStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE fraud_score > 70) as high_risk
      FROM transactions
    `);
    console.log('✅ Transactions stats:', transactionsStats.rows[0]);

    console.log('📊 Admin Dashboard: Fetching critical logs...');
    
    // Critical logs - FIXED: Limit to avoid overwhelming response
    let criticalLogs = [];
    try {
      const logsResult = await auditService.getAuditLogs(
        { severity: 'critical' },
        { page: 1, limit: 5 }
      );
      criticalLogs = logsResult.logs || [];
      console.log('✅ Critical logs fetched:', criticalLogs.length);
    } catch (logError) {
      console.warn('⚠️ Could not fetch critical logs:', logError.message);
      // Don't fail the entire request if logs fail
    }

    const responseData = {
      users: {
        total_users: parseInt(usersStats.rows[0].total_users) || 0,
        active_users: parseInt(usersStats.rows[0].active_users) || 0,
        suspended_users: parseInt(usersStats.rows[0].suspended_users) || 0,
        new_users_week: parseInt(usersStats.rows[0].new_users_week) || 0
      },
      accounts: {
        total_accounts: parseInt(accountsStats.rows[0].total_accounts) || 0,
        // Convert balance from cents to dollars and format
        total_balance: (parseInt(accountsStats.rows[0].total_balance) || 0) / 100,
        active_accounts: parseInt(accountsStats.rows[0].active_accounts) || 0
      },
      transactions: {
        total_transactions: parseInt(transactionsStats.rows[0].total_transactions) || 0,
        last_24h: parseInt(transactionsStats.rows[0].last_24h) || 0,
        pending: parseInt(transactionsStats.rows[0].pending) || 0,
        high_risk: parseInt(transactionsStats.rows[0].high_risk) || 0
      },
      criticalLogs: criticalLogs
    };

    console.log('✅ Admin Dashboard: Sending response');
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Admin Dashboard Error:', error);
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
      { page: parseInt(page) || 1, limit: parseInt(limit) || 50 }
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

// GET /api/admin/audit-logs/critical
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

// DELETE /api/admin/audit-logs/cleanup
router.delete(
  '/audit-logs/cleanup',
  sensitiveOperationRateLimiter(),
  async (req, res, next) => {
    try {
      const { daysToKeep = 365 } = req.body;

      const deletedCount = await auditService.cleanupOldLogs(daysToKeep);

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

// GET /api/admin/reports/daily
router.get('/reports/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const report = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM transactions
      WHERE DATE(created_at) = $1
      GROUP BY DATE(created_at)
    `, [date]);

    res.json({
      success: true,
      data: report.rows[0] || { date, total_transactions: 0, total_amount: 0, completed: 0, failed: 0 }
    });
  } catch (error) {
    logger.logError(error, { context: 'Daily Report' });
    next(error);
  }
});
// GET /api/admin/users - List all users (ADMIN)
router.get('/users', validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, role } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id,
        email,
        username,
        first_name,
        last_name,
        role,
        account_status,
        created_at,
        last_login
      FROM users
      WHERE 1 = 1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND account_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const usersResult = await pool.query(query, params);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM users
    `);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'Admin Users List' });
    next(error);
  }
});

// GET /api/admin/accounts - List all accounts
router.get('/accounts', validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, accountType } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, 
             u.email, u.first_name, u.last_name, u.username
      FROM accounts a
      INNER JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND a.account_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (accountType) {
      query += ` AND a.account_type = $${paramIndex}`;
      params.push(accountType);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const countResult = await pool.query('SELECT COUNT(*) as total FROM accounts');

    res.json({
      success: true,
      data: {
        accounts: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'Admin List Accounts' });
    next(error);
  }
});

module.exports = router;