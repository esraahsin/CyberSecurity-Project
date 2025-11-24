/**
 * Validateurs personnalisés pour l'application
 * @module utils/validators
 */

const validator = require('validator');

/**
 * Valide un mot de passe fort
 * @param {string} password - Mot de passe à valider
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validatePassword = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Valide un email
 * @param {string} email - Email à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  // Check length FIRST before format validation
  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  
  if (!validator.isEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un nom d'utilisateur
 * @param {string} username - Username à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }
  
  if (username.length > 30) {
    return { valid: false, error: 'Username must not exceed 30 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { 
      valid: false, 
      error: 'Username can only contain letters, numbers, underscores and hyphens' 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un numéro de téléphone
 * @param {string} phone - Numéro à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }
  
  // Remove spaces and dashes for validation
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Accept numbers with or without + prefix
  // Must be 10-15 digits (with optional + at start)
  const phoneRegex = /^\+?\d{10,15}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide une URL
 * @param {string} url - URL à valider
 * @param {Object} options - Options de validation
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateUrl = (url, options = {}) => {
  const { 
    requireProtocol = true,
    protocols = ['http', 'https']
  } = options;
  
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  
  if (!validator.isURL(url, { 
    protocols,
    require_protocol: requireProtocol 
  })) {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide une date
 * @param {string} date - Date à valider (ISO format)
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateDate = (date) => {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }
  
  if (!validator.isISO8601(date)) {
    return { valid: false, error: 'Invalid date format (use ISO 8601)' };
  }
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un UUID
 * @param {string} uuid - UUID à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'UUID is required' };
  }
  
  if (!validator.isUUID(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un ObjectId MongoDB
 * @param {string} id - ObjectId à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateMongoId = (id) => {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required' };
  }
  
  if (!validator.isMongoId(id)) {
    return { valid: false, error: 'Invalid ID format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un rôle utilisateur
 * @param {string} role - Rôle à valider
 * @param {Array<string>} allowedRoles - Rôles autorisés
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateRole = (role, allowedRoles = ['user', 'admin', 'moderator']) => {
  if (!role || typeof role !== 'string') {
    return { valid: false, error: 'Role is required' };
  }
  
  if (!allowedRoles.includes(role)) {
    return { 
      valid: false, 
      error: `Role must be one of: ${allowedRoles.join(', ')}` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide une adresse IP
 * @param {string} ip - Adresse IP à valider
 * @param {number} version - Version IP (4 ou 6)
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateIP = (ip, version = null) => {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' };
  }
  
  const isValidIP = version === 4 
    ? validator.isIP(ip, 4)
    : version === 6
    ? validator.isIP(ip, 6)
    : validator.isIP(ip);
  
  if (!isValidIP) {
    return { 
      valid: false, 
      error: `Invalid IPv${version || ''} address format` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un port réseau
 * @param {number|string} port - Port à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validatePort = (port) => {
  const portNum = parseInt(port);
  
  if (isNaN(portNum)) {
    return { valid: false, error: 'Port must be a number' };
  }
  
  if (!validator.isPort(String(portNum))) {
    return { valid: false, error: 'Port must be between 0 and 65535' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un niveau de sévérité
 * @param {string} severity - Niveau à valider
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateSeverity = (severity) => {
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  
  if (!severity || typeof severity !== 'string') {
    return { valid: false, error: 'Severity is required' };
  }
  
  if (!validSeverities.includes(severity.toLowerCase())) {
    return { 
      valid: false, 
      error: `Severity must be one of: ${validSeverities.join(', ')}` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un statut
 * @param {string} status - Statut à valider
 * @param {Array<string>} allowedStatuses - Statuts autorisés
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateStatus = (status, allowedStatuses) => {
  if (!status || typeof status !== 'string') {
    return { valid: false, error: 'Status is required' };
  }
  
  if (!allowedStatuses.includes(status)) {
    return { 
      valid: false, 
      error: `Status must be one of: ${allowedStatuses.join(', ')}` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide une plage de nombres
 * @param {number} value - Valeur à valider
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateRange = (value, min, max) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Value must be a number' };
  }
  
  if (num < min || num > max) {
    return { 
      valid: false, 
      error: `Value must be between ${min} and ${max}` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide une longueur de chaîne
 * @param {string} str - Chaîne à valider
 * @param {number} min - Longueur minimale
 * @param {number} max - Longueur maximale
 * @returns {Object} { valid: boolean, error: string|null }
 */
const validateLength = (str, min = 0, max = Infinity) => {
  if (typeof str !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }
  
  if (str.length < min) {
    return { 
      valid: false, 
      error: `Length must be at least ${min} characters` 
    };
  }
  
  if (str.length > max) {
    return { 
      valid: false, 
      error: `Length must not exceed ${max} characters` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un JSON
 * @param {string} str - JSON à valider
 * @returns {Object} { valid: boolean, error: string|null, data: Object|null }
 */
const validateJSON = (str) => {
  if (typeof str !== 'string') {
    return { valid: false, error: 'Value must be a string', data: null };
  }
  
  try {
    const data = JSON.parse(str);
    return { valid: true, error: null, data };
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format', data: null };
  }
};

/**
 * Crée un validateur personnalisé
 * @param {Function} validatorFn - Fonction de validation
 * @param {string} errorMessage - Message d'erreur
 * @returns {Function} Validateur
 */
const createValidator = (validatorFn, errorMessage) => {
  return (value) => {
    try {
      const isValid = validatorFn(value);
      return {
        valid: isValid,
        error: isValid ? null : errorMessage
      };
    } catch (error) {
      return {
        valid: false,
        error: errorMessage
      };
    }
  };
};

module.exports = {
  validatePassword,
  validateEmail,
  validateUsername,
  validatePhone,
  validateUrl,
  validateDate,
  validateUUID,
  validateMongoId,
  validateRole,
  validateIP,
  validatePort,
  validateSeverity,
  validateStatus,
  validateRange,
  validateLength,
  validateJSON,
  createValidator
};