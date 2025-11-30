/**
 * Routes de gestion des transactions
 * @module routes/transaction.routes
 */

const express = require('express');
const router = express.Router();

// Controller
const TransactionController = require('../controllers/TransactionController');

// Middleware
const { 
  authenticateToken 
} = require('../middleware/auth.middleware');

const { 
  sensitiveOperationRateLimiter 
} = require('../middleware/security.middleware');

const {
  validateIdParam,
  validatePagination,
  validateDateRange,
  validateTransfer
} = require('../middleware/validation.middleware');

// ============================================
// Toutes les routes nécessitent l'authentification
// ============================================
router.use(authenticateToken);

// ============================================
// Routes de gestion des transactions
// ============================================

/**
 * POST /api/transactions/transfer
 * Effectue un transfert entre comptes
 */
router.post(
  '/transfer',
  validateTransfer,
  sensitiveOperationRateLimiter(),
  TransactionController.createTransfer
);

/**
 * POST /api/transactions/deposit
 * Effectue un dépôt
 */
router.post(
  '/deposit',
  sensitiveOperationRateLimiter(),
  TransactionController.createDeposit
);

/**
 * POST /api/transactions/withdraw
 * Effectue un retrait
 */
router.post(
  '/withdraw',
  sensitiveOperationRateLimiter(),
  TransactionController.createWithdrawal
);

/**
 * GET /api/transactions
 * Liste toutes les transactions de l'utilisateur
 */
router.get(
  '/',
  validatePagination,
  validateDateRange,
  TransactionController.listUserTransactions
);

/**
 * GET /api/transactions/pending
 * Liste les transactions en attente
 */
router.get(
  '/pending',
  TransactionController.getPendingTransactions
);

/**
 * GET /api/transactions/stats
 * Récupère les statistiques de transactions
 */
router.get(
  '/stats',
  TransactionController.getTransactionStats
);

/**
 * GET /api/transactions/export
 * Exporte les transactions au format CSV
 */
router.get(
  '/export',
  validateDateRange,
  TransactionController.exportTransactions
);

/**
 * GET /api/transactions/:id
 * Récupère les détails d'une transaction
 */
router.get(
  '/:id',
  validateIdParam,
  TransactionController.getTransactionById
);

/**
 * POST /api/transactions/:id/cancel
 * Annule une transaction en attente
 */
router.post(
  '/:id/cancel',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  TransactionController.cancelTransaction
);

/**
 * POST /api/transactions/:id/dispute
 * Conteste une transaction
 */
router.post(
  '/:id/dispute',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  TransactionController.disputeTransaction
);

module.exports = router;