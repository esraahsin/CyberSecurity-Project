/**
 * Routes de gestion des comptes bancaires
 * @module routes/account.routes
 */

const express = require('express');
const router = express.Router();

// Controller
const AccountController = require('../controllers/AccountController');

// Middleware
const { 
  authenticateToken,
  requireOwnership 
} = require('../middleware/auth.middleware');

const { 
  sensitiveOperationRateLimiter 
} = require('../middleware/security.middleware');

const {
  validateIdParam,
  validatePagination,
  validateDateRange,
  validateAmount
} = require('../middleware/validation.middleware');

// ============================================
// Toutes les routes nécessitent l'authentification
// ============================================
router.use(authenticateToken);

// ============================================
// Routes de gestion des comptes
// ============================================

/**
 * GET /api/accounts
 * Liste tous les comptes de l'utilisateur
 */
router.get(
  '/',
  AccountController.listAccounts
);

/**
 * POST /api/accounts
 * Créer un nouveau compte
 */
router.post(
  '/',
  sensitiveOperationRateLimiter(),
  AccountController.createAccount
);

/**
 * GET /api/accounts/:id
 * Détails d'un compte spécifique
 */
router.get(
  '/:id',
  validateIdParam,
  AccountController.getAccountDetails
);

/**
 * GET /api/accounts/:id/balance
 * Récupérer uniquement le solde
 */
router.get(
  '/:id/balance',
  validateIdParam,
  AccountController.getBalance
);

/**
 * GET /api/accounts/:id/transactions
 * Liste les transactions d'un compte
 */
router.get(
  '/:id/transactions',
  validateIdParam,
  validatePagination,
  validateDateRange,
  AccountController.getAccountTransactions
);

/**
 * GET /api/accounts/:id/statement
 * Générer un relevé de compte
 */
router.get(
  '/:id/statement',
  validateIdParam,
  validateDateRange,
  AccountController.getStatement
);

/**
 * PUT /api/accounts/:id/limits
 * Mettre à jour les limites de transfert
 */
router.put(
  '/:id/limits',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  AccountController.updateLimits
);

/**
 * PUT /api/accounts/:id/status
 * Changer le statut du compte (freeze/unfreeze)
 */
router.put(
  '/:id/status',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  AccountController.updateStatus
);

/**
 * DELETE /api/accounts/:id
 * Fermer un compte
 */
router.delete(
  '/:id',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  AccountController.closeAccount
);

module.exports = router;