/**
 * Logger centralisé avec Winston
 * Gère les logs de l'application avec format JSON et timestamp
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');

// Configuration des formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format console coloré pour le développement
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cybersecurity-api' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    }),
    
    // File transport pour les erreurs
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport pour tous les logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Ne pas crasher sur les erreurs de logging
  exitOnError: false
});

// Stream pour Morgan (logs HTTP)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

/**
 * Log une requête HTTP
 * @param {Object} req - Express request object
 * @param {string} message - Message optionnel
 */
logger.logRequest = (req, message = 'HTTP Request') => {
  logger.info(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id
  });
};

/**
 * Log une erreur avec contexte
 * @param {Error} error - Erreur à logger
 * @param {Object} context - Contexte additionnel
 */
logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

/**
 * Log une activité de sécurité
 * @param {string} event - Type d'événement
 * @param {Object} details - Détails de l'événement
 */
logger.logSecurity = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = logger;