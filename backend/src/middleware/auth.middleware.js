/**
 * Middleware d'authentification JWT
 * Vérifie et valide les tokens d'accès
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Vérifie le token JWT dans les headers
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Vérifier si le token est blacklisté
    const isBlacklisted = await redisClient.get(`blacklist:token:${token}`);
    if (isBlacklisted) {
      logger.logSecurity('BLACKLISTED_TOKEN_USED', { token: token.substring(0, 20) });
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token has been revoked'
      });
    }

    // Vérifier et décoder le token
    jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
      if (err) {
        logger.logSecurity('INVALID_TOKEN', { 
          error: err.message,
          ip: req.ip 
        });
        
        return res.status(403).json({
          error: 'Invalid token',
          message: 'Token verification failed'
        });
      }

      // Vérifier si la session existe dans Redis
      const session = await redisClient.get(`session:${decoded.userId}`);
      if (!session) {
        return res.status(401).json({
          error: 'Session expired',
          message: 'Please login again'
        });
      }

      // Ajouter les infos utilisateur à la requête
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
      
      req.token = token;

      next();
    });
  } catch (error) {
    logger.logError(error, { context: 'JWT Authentication' });
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Vérifie que l'utilisateur a un rôle spécifique
 * @param {Array<string>} roles - Rôles autorisés
 * @returns {Function} Middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login first'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurity('UNAUTHORIZED_ROLE_ACCESS', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Vérifie que l'utilisateur accède à ses propres données
 * @param {string} paramName - Nom du paramètre contenant l'userId
 * @returns {Function} Middleware
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const resourceUserId = req.params[paramName] || req.body[paramName];
    
    // Admin peut accéder à toutes les ressources
    if (req.user.role === 'admin') {
      return next();
    }

    // Vérifier que l'utilisateur accède à ses propres données
    if (resourceUserId !== req.user.id.toString()) {
      logger.logSecurity('UNAUTHORIZED_RESOURCE_ACCESS', {
        userId: req.user.id,
        attemptedResourceUserId: resourceUserId,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Middleware optionnel - Ajoute user si token présent
 * Ne bloque pas si pas de token
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Pas de token, on continue sans user
    }

    jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
      if (!err) {
        const session = await redisClient.get(`session:${decoded.userId}`);
        if (session) {
          req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role
          };
        }
      }
      next();
    });
  } catch (error) {
    next(); // En cas d'erreur, on continue sans user
  }
};

/**
 * Vérifie que le MFA est activé pour l'utilisateur
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const requireMFA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Vérifier si MFA est vérifié dans la session
    const sessionData = await redisClient.get(`session:${req.user.id}`);
    if (!sessionData) {
      return res.status(401).json({
        error: 'Session not found'
      });
    }

    const session = JSON.parse(sessionData);
    if (!session.mfaVerified) {
      return res.status(403).json({
        error: 'MFA verification required',
        message: 'Please verify your MFA code'
      });
    }

    next();
  } catch (error) {
    logger.logError(error, { context: 'MFA Check' });
    res.status(500).json({
      error: 'MFA verification failed'
    });
  }
};

/**
 * Refresh le token d'accès avec le refresh token
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    // Vérifier le refresh token
    jwt.verify(refreshToken, jwtConfig.refreshSecret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          error: 'Invalid refresh token'
        });
      }

      // Vérifier que le refresh token existe dans Redis
      const storedToken = await redisClient.get(`refresh:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        return res.status(403).json({
          error: 'Refresh token mismatch'
        });
      }

      // Générer un nouveau access token
      const newAccessToken = jwt.sign(
        { 
          userId: decoded.userId, 
          email: decoded.email,
          role: decoded.role
        },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      res.json({
        accessToken: newAccessToken
      });
    });
  } catch (error) {
    logger.logError(error, { context: 'Token Refresh' });
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership,
  optionalAuth,
  requireMFA,
  refreshToken
};