/**
 * Utilitaires de sanitization pour sécuriser les entrées
 * Protège contre XSS, injection SQL, NoSQL injection
 * @module utils/sanitizer
 */

const validator = require('validator');
const mongoSanitize = require('express-mongo-sanitize');

/**
 * Nettoie une chaîne de caractères HTML
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str);
};

/**
 * Nettoie les caractères spéciaux dangereux
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Retire les caractères de contrôle
  return str
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
};

/**
 * Sanitize un email
 * @param {string} email - Email à nettoyer
 * @returns {string|null} Email nettoyé ou null si invalide
 */
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  
  const normalized = validator.normalizeEmail(email);
  return validator.isEmail(normalized) ? normalized : null;
};

/**
 * Sanitize une URL
 * @param {string} url - URL à nettoyer
 * @returns {string|null} URL nettoyée ou null si invalide
 */
const sanitizeUrl = (url) => {
  if (typeof url !== 'string') return null;
  
  // Trim whitespace FIRST
  const trimmed = url.trim();
  
  // Vérifie si c'est une URL valide
  if (!validator.isURL(trimmed, { 
    protocols: ['http', 'https'],
    require_protocol: true 
  })) {
    return null;
  }
  
  return trimmed;
};

/**
 * Sanitize un numéro de téléphone
 * @param {string} phone - Numéro à nettoyer
 * @returns {string} Numéro nettoyé
 */
const sanitizePhone = (phone) => {
  if (typeof phone !== 'string') return '';
  
  // Garde uniquement les chiffres, +, -, (, )
  return phone.replace(/[^0-9+\-()]/g, '');
};

/**
 * Sanitize un objet récursivement
 * @param {Object} obj - Objet à nettoyer
 * @param {Object} options - Options de sanitization
 * @returns {Object} Objet nettoyé
 */
const sanitizeObject = (obj, options = {}) => {
  const { 
    removeEmpty = false,
    trimStrings = true,
    escapeHtml = true 
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const sanitizedArray = obj.map(item => {
      if (typeof item === 'string') {
        let sanitizedValue = item;
        
        // Trim strings in arrays too!
        if (trimStrings) {
          sanitizedValue = sanitizedValue.trim();
        }
        
        if (escapeHtml) {
          sanitizedValue = validator.escape(sanitizedValue);
        }
        
        return sanitizedValue;
      }
      
      return sanitizeObject(item, options);
    });
    
    return sanitizedArray;
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip les valeurs vides si demandé
      if (removeEmpty && (value === '' || value === null || value === undefined)) {
        continue;
      }

      if (typeof value === 'string') {
        let sanitizedValue = value;
        
        if (trimStrings) {
          sanitizedValue = sanitizedValue.trim();
        }
        
        if (escapeHtml) {
          sanitizedValue = validator.escape(sanitizedValue);
        }
        
        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, options);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  return obj;
};

/**
 * Protège contre les injections NoSQL
 * @param {Object} obj - Objet à protéger
 * @returns {Object} Objet protégé
 */
const sanitizeNoSqlInjection = (obj) => {
  return mongoSanitize.sanitize(obj, {
    replaceWith: '_'
  });
};

/**
 * Nettoie un chemin de fichier
 * @param {string} filepath - Chemin à nettoyer
 * @returns {string} Chemin nettoyé
 */
const sanitizeFilePath = (filepath) => {
  if (typeof filepath !== 'string') return '';
  
  // Retire les caractères dangereux et les tentatives de traversal
  return filepath
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '')
    .replace(/^\/+/, '');
};

/**
 * Valide et sanitize un nom de fichier
 * @param {string} filename - Nom de fichier
 * @returns {string|null} Nom de fichier sécurisé ou null
 */
const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string' || !filename) return null;
  
  // Retire les caractères dangereux
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
  
  // Vérifie qu'il reste un nom valide
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return null;
  }
  
  return sanitized;
};

/**
 * Sanitize une entrée de recherche
 * @param {string} query - Requête de recherche
 * @returns {string} Requête nettoyée
 */
const sanitizeSearchQuery = (query) => {
  if (typeof query !== 'string') return '';
  
  return query
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 500);
};

/**
 * Nettoie les données sensibles d'un objet pour le logging
 * @param {Object} obj - Objet à nettoyer
 * @returns {Object} Objet sans données sensibles
 */
const sanitizeForLogging = (obj) => {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
    'creditCard',
    'ssn'
  ];

  const sanitize = (data) => {
    if (data === null || data === undefined) return data;

    if (Array.isArray(data)) {
      return data.map(item => sanitize(item));
    }

    if (typeof data === 'object') {
      const result = {};
      
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        // Masque les champs sensibles
        if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(value);
        }
      }
      
      return result;
    }

    return data;
  };

  return sanitize(obj);
};

/**
 * Valide et sanitize les paramètres de pagination
 * @param {Object} params - Paramètres bruts
 * @returns {Object} Paramètres validés
 */
const sanitizePaginationParams = (params) => {
  const { page = 1, limit = 10, sortBy, order } = params;
  
  const sanitized = {
    page: Math.max(1, parseInt(page) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit) || 10))
  };
  
  if (sortBy && typeof sortBy === 'string') {
    // Check if there are any non-alphanumeric characters (potential SQL injection)
    const hasSpecialChars = /[^a-zA-Z0-9]/.test(sortBy);
    
    if (hasSpecialChars) {
      // Split by dangerous chars (semicolon, space, etc) and take first part
      // Then remove remaining non-alphanumeric (like dots) and lowercase
      // "user.name; DROP TABLE" -> "user.name" -> "username"
      const firstPart = sortBy.split(/[;\s]/)[0];
      sanitized.sortBy = firstPart.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    } else {
      // No special chars, keep as is (preserves case for valid inputs like 'createdAt')
      sanitized.sortBy = sortBy;
    }
  }
  
  if (order && ['asc', 'desc'].includes(order.toLowerCase())) {
    sanitized.order = order.toLowerCase();
  }
  
  return sanitized;
};

/**
 * Middleware Express pour sanitizer le body
 * @returns {Function} Middleware Express
 */
const sanitizeBodyMiddleware = (options = {}) => {
  return (req, res, next) => {
    if (req.body) {
      req.body = sanitizeObject(req.body, options);
      req.body = sanitizeNoSqlInjection(req.body);
    }
    next();
  };
};

/**
 * Middleware Express pour sanitizer les query params
 * @returns {Function} Middleware Express
 */
const sanitizeQueryMiddleware = (options = {}) => {
  return (req, res, next) => {
    if (req.query) {
      req.query = sanitizeObject(req.query, options);
      req.query = sanitizeNoSqlInjection(req.query);
    }
    next();
  };
};

module.exports = {
  sanitizeHtml,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeObject,
  sanitizeNoSqlInjection,
  sanitizeFilePath,
  sanitizeFilename,
  sanitizeSearchQuery,
  sanitizeForLogging,
  sanitizePaginationParams,
  sanitizeBodyMiddleware,
  sanitizeQueryMiddleware
};