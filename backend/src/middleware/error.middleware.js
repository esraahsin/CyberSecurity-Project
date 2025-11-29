/**
 * Middleware global de gestion des erreurs
 * Gère toutes les erreurs de l'application de manière centralisée
 * @module middleware/error
 */

const logger = require('../utils/logger');

/**
 * Formate les erreurs en fonction du type
 * @param {Error} err
 * @returns {Object} objet formaté
 */
const formatError = (err) => {
  // Erreurs JWT (token invalide, expiré…)
  if (err.name === 'JsonWebTokenError') {
    return {
      status: 401,
      error: 'Invalid token',
      message: 'Token verification failed'
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      status: 401,
      error: 'Token expired',
      message: 'Please login again'
    };
  }

  // Erreurs de validation MongoDB
  if (err.name === 'ValidationError') {
    return {
      status: 400,
      error: 'Validation error',
      message: err.message,
      details: err.errors
    };
  }

  // Erreur clé unique MongoDB
  if (err.code === 11000) {
    return {
      status: 409,
      error: 'Duplicate key',
      message: 'A record with this information already exists.'
    };
  }

  // Rate Limit
  if (err.status === 429) {
    return {
      status: 429,
      error: 'Too many requests',
      message: 'Please try again later'
    };
  }

  // TypeError, SyntaxError…
  if (err instanceof SyntaxError) {
    return {
      status: 400,
      error: 'Syntax error',
      message: err.message
    };
  }

  // Erreur par défaut (serveur)
  return {
    status: err.status || 500,
    error: err.error || 'Internal server error',
    message: err.message || 'Something went wrong'
  };
};

/**
 * Middleware de gestion des erreurs
 * @param {Error} err
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const errorHandler = (err, req, res, next) => {
  // Log interne
  logger.logError(err, {
    context: 'Global Error Handler',
    ip: req.ip,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Formatage de l'erreur
  const formatted = formatError(err);

  // Ne jamais exposer stack trace en production
  const response = {
    error: formatted.error,
    message: formatted.message
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(formatted.status).json(response);
};

module.exports = errorHandler;
