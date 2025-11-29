/**
 * Routes d'authentification
 * @module routes/auth.routes
 */

const express = require('express');
const router = express.Router();

// Controllers
const AuthController = require('../controllers/AuthController');

// Middleware
const { 
  authenticateToken,
  requireMFA 
} = require('../middleware/auth.middleware');

const { 
  authRateLimiter,
  sensitiveOperationRateLimiter 
} = require('../middleware/security.middleware');

const {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateMFACode
} = require('../middleware/validation.middleware');

// ============================================
// Routes publiques (sans authentification)
// ============================================

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
router.post(
  '/register',
  authRateLimiter(),
  validateRegister,
  AuthController.register
);

/**
 * POST /api/auth/login
 * Connexion utilisateur
 */
router.post(
  '/login',
  authRateLimiter(),
  validateLogin,
  AuthController.login
);

/**
 * POST /api/auth/refresh
 * Rafraîchir le token d'accès
 */
router.post(
  '/refresh',
  AuthController.refresh
);

/**
 * POST /api/auth/request-password-reset
 * Demander une réinitialisation de mot de passe
 */
router.post(
  '/request-password-reset',
  authRateLimiter(),
  AuthController.requestPasswordReset
);

/**
 * POST /api/auth/verify-email
 * Vérifier l'email avec un token
 */
router.post(
  '/verify-email',
  AuthController.verifyEmail
);

// ============================================
// Routes protégées (authentification requise)
// ============================================

/**
 * POST /api/auth/logout
 * Déconnexion utilisateur
 */
router.post(
  '/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * GET /api/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
router.get(
  '/me',
  authenticateToken,
  AuthController.getProfile
);

/**
 * PUT /api/auth/profile
 * Mettre à jour le profil
 */
router.put(
  '/profile',
  authenticateToken,
  validateProfileUpdate,
  AuthController.updateProfile
);

/**
 * POST /api/auth/change-password
 * Changer le mot de passe
 */
router.post(
  '/change-password',
  authenticateToken,
  sensitiveOperationRateLimiter(),
  validatePasswordChange,
  AuthController.changePassword
);

/**
 * GET /api/auth/sessions
 * Récupérer toutes les sessions actives
 */
router.get(
  '/sessions',
  authenticateToken,
  AuthController.getSessions
);

/**
 * DELETE /api/auth/sessions/:sessionId
 * Terminer une session spécifique
 */
router.delete(
  '/sessions/:sessionId',
  authenticateToken,
  AuthController.terminateSession
);

/**
 * DELETE /api/auth/sessions
 * Terminer toutes les sessions sauf la courante
 */
router.delete(
  '/sessions',
  authenticateToken,
  sensitiveOperationRateLimiter(),
  AuthController.terminateAllSessions
);

module.exports = router;