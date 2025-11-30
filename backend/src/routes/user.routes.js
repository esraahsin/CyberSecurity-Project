/**
 * Routes de gestion des utilisateurs
 * @module routes/user.routes
 */

const express = require('express');
const router = express.Router();

// Controller
const UserController = require('../controllers/UserController');

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
  validateProfileUpdate
} = require('../middleware/validation.middleware');

// ============================================
// Toutes les routes nécessitent l'authentification
// ============================================
router.use(authenticateToken);

// ============================================
// Routes utilisateurs (tous les rôles)
// ============================================

/**
 * GET /api/users/:id
 * Récupère un utilisateur par ID
 */
router.get(
  '/:id',
  validateIdParam,
  UserController.getUserById
);

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur
 */
router.put(
  '/:id',
  validateIdParam,
  validateProfileUpdate,
  sensitiveOperationRateLimiter(),
  UserController.updateUser
);

/**
 * GET /api/users/:id/accounts
 * Récupère tous les comptes d'un utilisateur
 */
router.get(
  '/:id/accounts',
  validateIdParam,
  UserController.getUserAccounts
);

/**
 * GET /api/users/:id/stats
 * Récupère les statistiques d'un utilisateur
 */
router.get(
  '/:id/stats',
  validateIdParam,
  UserController.getUserStats
);

// ============================================
// Routes ADMIN ONLY
// ============================================

/**
 * GET /api/users
 * Liste tous les utilisateurs (ADMIN)
 */
router.get(
  '/',
  requireRole(['admin']),
  validatePagination,
  UserController.listUsers
);

/**
 * GET /api/users/search
 * Recherche d'utilisateurs (ADMIN)
 */
router.get(
  '/search',
  requireRole(['admin']),
  validatePagination,
  UserController.searchUsers
);

/**
 * DELETE /api/users/:id
 * Supprime un utilisateur (ADMIN ou propriétaire)
 */
router.delete(
  '/:id',
  validateIdParam,
  sensitiveOperationRateLimiter(),
  UserController.deleteUser
);

/**
 * PUT /api/users/:id/role
 * Change le rôle d'un utilisateur (ADMIN)
 */
router.put(
  '/:id/role',
  requireRole(['admin']),
  validateIdParam,
  sensitiveOperationRateLimiter(),
  UserController.updateUserRole
);

/**
 * PUT /api/users/:id/status
 * Change le statut d'un utilisateur (ADMIN)
 */
router.put(
  '/:id/status',
  requireRole(['admin']),
  validateIdParam,
  sensitiveOperationRateLimiter(),
  UserController.updateUserStatus
);

/**
 * POST /api/users/:id/unlock
 * Déverrouille un compte (ADMIN)
 */
router.post(
  '/:id/unlock',
  requireRole(['admin']),
  validateIdParam,
  sensitiveOperationRateLimiter(),
  UserController.unlockUser
);

/**
 * POST /api/users/:id/reset-password
 * Réinitialise le mot de passe (ADMIN)
 */
router.post(
  '/:id/reset-password',
  requireRole(['admin']),
  validateIdParam,
  sensitiveOperationRateLimiter(),
  UserController.resetUserPassword
);

module.exports = router;