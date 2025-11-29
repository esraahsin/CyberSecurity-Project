/**
 * Middlewares de sécurité principaux
 * Helmet, CORS, CSRF, Rate Limiting
 * @module middleware/security
 */

const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Configuration Helmet - Sécurise les headers HTTP
 * Protège contre XSS, clickjacking, MIME sniffing
 * @returns {Function} Middleware Helmet
 */
const helmetMiddleware = () => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Autres protections
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
};

/**
 * Configuration CORS - Contrôle les requêtes cross-origin
 * Permet uniquement les origines autorisées
 * @returns {Function} Middleware CORS
 */
const corsMiddleware = () => {
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Permet les requêtes sans origin (mobile apps, Postman)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.logSecurity('CORS_BLOCKED', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 600, // 10 minutes
    optionsSuccessStatus: 204
  });
};

/**
 * Génère un token CSRF
 * @returns {string} Token CSRF
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Protection CSRF - Prévient les attaques Cross-Site Request Forgery
 * Vérifie que chaque requête modifiante possède un token valide
 * @returns {Function} Middleware CSRF
 */
const csrfProtection = () => {
  return async (req, res, next) => {
    // Skip CSRF pour certaines routes
    const skipRoutes = ['/api/auth/login', '/api/auth/register', '/health'];
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // GET et HEAD ne nécessitent pas de protection CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    try {
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      
      if (!token) {
        logger.logSecurity('CSRF_TOKEN_MISSING', { 
          ip: req.ip, 
          path: req.path 
        });
        return res.status(403).json({ 
          error: 'CSRF token missing' 
        });
      }

      // Vérifier le token dans Redis
      const userId = req.user?.id || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      const storedToken = await redisClient.get(`csrf:${userId}`);
      
      if (!storedToken || storedToken !== token) {
        logger.logSecurity('CSRF_TOKEN_INVALID', { 
          ip: req.ip, 
          userId,
          path: req.path 
        });
        return res.status(403).json({ 
          error: 'Invalid CSRF token' 
        });
      }

      next();
    } catch (error) {
      logger.logError(error, { context: 'CSRF Protection' });
      res.status(500).json({ 
        error: 'CSRF validation failed' 
      });
    }
  };
};

/**
 * Endpoint pour obtenir un token CSRF
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getCsrfToken = async (req, res) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    const token = generateCsrfToken();
    
    // Stocker le token dans Redis (expire dans 1 heure)
    await redisClient.setEx(`csrf:${userId}`, 3600, token);
    
    res.json({ csrfToken: token });
  } catch (error) {
    logger.logError(error, { context: 'CSRF Token Generation' });
    res.status(500).json({ 
      error: 'Failed to generate CSRF token' 
    });
  }
};

/**
 * Rate Limiter général - Limite le nombre de requêtes par IP
 * Protège contre le brute force et les attaques DDoS
 * @returns {Function} Middleware Rate Limiter
 */
const rateLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requêtes
    message: {
      error: 'Too many requests',
      message: 'Please try again later',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.logSecurity('RATE_LIMIT_EXCEEDED', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('user-agent')
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: 'You have exceeded the request limit. Please try again later.',
        retryAfter: 60
      });
    },
    skip: (req) => {
      // Skip pour les health checks
      return req.path === '/health';
    }
  });
};

/**
 * Rate Limiter strict pour l'authentification
 * Limite drastique pour prévenir le brute force sur login
 * @returns {Function} Middleware Rate Limiter Auth
 */
const authRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 tentatives max
    skipSuccessfulRequests: true, // Ne compte que les échecs
    message: {
      error: 'Too many login attempts',
      retryAfter: 900
    },
    handler: (req, res) => {
      logger.logSecurity('AUTH_RATE_LIMIT_EXCEEDED', {
        ip: req.ip,
        email: req.body?.email,
        userAgent: req.get('user-agent')
      });
      
      res.status(429).json({
        error: 'Too many login attempts',
        message: 'Account temporarily locked. Please try again in 15 minutes.',
        retryAfter: 900
      });
    }
  });
};

/**
 * Rate Limiter pour les opérations sensibles
 * Transactions, changements de mot de passe, etc.
 * @returns {Function} Middleware Rate Limiter
 */
const sensitiveOperationRateLimiter = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 10, // 10 opérations max
    message: {
      error: 'Too many sensitive operations',
      retryAfter: 3600
    },
    handler: (req, res) => {
      logger.logSecurity('SENSITIVE_OPERATION_RATE_LIMIT', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.path
      });
      
      res.status(429).json({
        error: 'Too many sensitive operations',
        message: 'You have exceeded the limit. Please try again later.',
        retryAfter: 3600
      });
    }
  });
};

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  csrfProtection,
  getCsrfToken,
  rateLimiter,
  authRateLimiter,
  sensitiveOperationRateLimiter
};