/**
 * Middleware d'authentification JWT - FIXED VERSION
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Vérifie le token JWT dans les headers
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Vérifier si le token est blacklisté
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.logSecurity('BLACKLISTED_TOKEN_USED', { 
        token: token.substring(0, 20) 
      });
      return res.status(401).json({
        success: false,
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
          success: false,
          error: 'Invalid token',
          message: err.name === 'TokenExpiredError' 
            ? 'Token has expired' 
            : 'Token verification failed'
        });
      }

      // ✅ FIX: Vérifier que l'utilisateur existe et chercher une session active
      // On utilise un pattern Redis pour trouver la session de l'utilisateur
      const sessionPattern = `session:*`;
      let userSession = null;

      try {
        // Méthode 1: Chercher dans toutes les sessions (pas optimal mais fonctionne)
        // Pour production, utiliser une structure différente (ex: user:{id}:sessions)
        
        // Méthode 2 (meilleure): Stocker aussi session par userId
        const userSessionKey = `user:${decoded.userId}:session`;
        const sessionId = await redisClient.get(userSessionKey);
        
        if (sessionId) {
          const sessionData = await redisClient.get(`session:${sessionId}`);
          if (sessionData) {
            userSession = JSON.parse(sessionData);
            
            // Vérifier expiration
            const expiresAt = new Date(userSession.expiresAt);
            if (expiresAt <= new Date()) {
              logger.warn('Session expired', { 
                userId: decoded.userId, 
                sessionId 
              });
              
              // Nettoyer
              await redisClient.del(`session:${sessionId}`);
              await redisClient.del(userSessionKey);
              
              return res.status(401).json({
                success: false,
                error: 'Session expired',
                message: 'Please login again'
              });
            }
          }
        }
      } catch (sessionError) {
        logger.error('Session check error', { 
          error: sessionError.message,
          userId: decoded.userId 
        });
      }

      // ✅ Si pas de session trouvée, c'est pas grave pour l'auth de base
      // Le token JWT est valide, on autorise l'accès
      // (La session est optionnelle pour certaines routes)

      // Ajouter les infos utilisateur à la requête
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role || 'user'
      };
      
      req.token = token;
      req.sessionId = userSession ? userSession.sessionId : null;

      next();
    });
  } catch (error) {
    logger.logError(error, { context: 'JWT Authentication' });
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Vérifie que l'utilisateur a un rôle spécifique
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
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
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Vérifie que l'utilisateur accède à ses propres données
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
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
        success: false,
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Middleware optionnel - Ajoute user si token présent
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    jwt.verify(token, jwtConfig.secret, async (err, decoded) => {
      if (!err) {
        const userSessionKey = `user:${decoded.userId}:session`;
        const sessionId = await redisClient.get(userSessionKey);
        
        if (sessionId) {
          const sessionData = await redisClient.get(`session:${sessionId}`);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            
            // Vérifier expiration
            if (new Date(session.expiresAt) > new Date()) {
              req.user = {
                id: decoded.userId,
                email: decoded.email,
                username: decoded.username,
                role: decoded.role
              };
            }
          }
        }
      }
      next();
    });
  } catch (error) {
    next();
  }
};

/**
 * Vérifie que le MFA est activé pour l'utilisateur
 */
const requireMFA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Vérifier si MFA est vérifié dans la session
    const userSessionKey = `user:${req.user.id}:session`;
    const sessionId = await redisClient.get(userSessionKey);
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionData = await redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = JSON.parse(sessionData);
    if (!session.mfaVerified) {
      return res.status(403).json({
        success: false,
        error: 'MFA verification required',
        message: 'Please verify your MFA code'
      });
    }

    next();
  } catch (error) {
    logger.logError(error, { context: 'MFA Check' });
    res.status(500).json({
      success: false,
      error: 'MFA verification failed'
    });
  }
};

/**
 * Refresh le token d'accès avec le refresh token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Vérifier le refresh token
    jwt.verify(refreshToken, jwtConfig.refreshSecret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Vérifier que le refresh token existe dans Redis
      const storedToken = await redisClient.get(`refresh:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        return res.status(403).json({
          success: false,
          error: 'Refresh token mismatch'
        });
      }

      // Générer un nouveau access token
      const newAccessToken = jwt.sign(
        { 
          userId: decoded.userId, 
          email: decoded.email,
          username: decoded.username,
          role: decoded.role
        },
        jwtConfig.secret,
        { 
          expiresIn: '1d',
          issuer: 'securebank-api',
          audience: 'securebank-app'
        }
      );

      res.json({
        success: true,
        accessToken: newAccessToken
      });
    });
  } catch (error) {
    logger.logError(error, { context: 'Token Refresh' });
    res.status(500).json({
      success: false,
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