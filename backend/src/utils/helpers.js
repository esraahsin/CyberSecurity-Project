/**
 * Fonctions utilitaires générales
 * @module utils/helpers
 */

const crypto = require('crypto');

/**
 * Génère un token aléatoire sécurisé
 * @param {number} length - Longueur du token en bytes
 * @returns {string} Token hexadécimal
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Génère un ID unique
 * @returns {string} UUID v4
 */
const generateId = () => {
  return crypto.randomUUID();
};

/**
 * Pause l'exécution pendant un certain temps
 * @param {number} ms - Millisecondes
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Formatte une date en ISO string
 * @param {Date} date - Date à formatter
 * @returns {string} Date formatée
 */
const formatDate = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Calcule la différence entre deux dates
 * @param {Date} date1 - Première date
 * @param {Date} date2 - Deuxième date
 * @returns {Object} Différence en jours, heures, minutes
 */
const dateDiff = (date1, date2) => {
  const diff = Math.abs(date2 - date1);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
};

/**
 * Tronque un texte à une longueur donnée
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {string} suffix - Suffixe à ajouter
 * @returns {string} Texte tronqué
 */
const truncate = (text, maxLength = 100, suffix = '...') => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitalise la première lettre d'une chaîne
 * @param {string} str - Chaîne à capitaliser
 * @returns {string} Chaîne capitalisée
 */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convertit une chaîne en slug
 * @param {string} str - Chaîne à convertir
 * @returns {string} Slug
 */
const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Vérifie si une valeur est un email valide
 * @param {string} email - Email à vérifier
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Vérifie si une valeur est une URL valide
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Masque une partie d'une chaîne
 * @param {string} str - Chaîne à masquer
 * @param {number} visibleStart - Caractères visibles au début
 * @param {number} visibleEnd - Caractères visibles à la fin
 * @param {string} maskChar - Caractère de masquage
 * @returns {string} Chaîne masquée
 */
const maskString = (str, visibleStart = 4, visibleEnd = 4, maskChar = '*') => {
  if (str.length <= visibleStart + visibleEnd) return str;
  
  const start = str.substring(0, visibleStart);
  const end = str.substring(str.length - visibleEnd);
  const masked = maskChar.repeat(str.length - visibleStart - visibleEnd);
  
  return `${start}${masked}${end}`;
};

/**
 * Génère un hash SHA256 d'une chaîne
 * @param {string} str - Chaîne à hasher
 * @returns {string} Hash hexadécimal
 */
const hashString = (str) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

/**
 * Pagination helper
 * @param {number} page - Numéro de page
 * @param {number} limit - Éléments par page
 * @returns {Object} Offset et limit
 */
const paginate = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  
  return {
    offset: (pageNum - 1) * limitNum,
    limit: limitNum,
    page: pageNum
  };
};

/**
 * Génère un objet de métadonnées de pagination
 * @param {number} total - Total d'éléments
 * @param {number} page - Page actuelle
 * @param {number} limit - Éléments par page
 * @returns {Object} Métadonnées
 */
const paginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Nettoie un objet en retirant les valeurs null/undefined
 * @param {Object} obj - Objet à nettoyer
 * @returns {Object} Objet nettoyé
 */
const cleanObject = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

/**
 * Sélectionne des clés spécifiques d'un objet
 * @param {Object} obj - Objet source
 * @param {Array<string>} keys - Clés à sélectionner
 * @returns {Object} Nouvel objet avec les clés sélectionnées
 */
const pick = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (obj.hasOwnProperty(key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Exclut des clés spécifiques d'un objet
 * @param {Object} obj - Objet source
 * @param {Array<string>} keys - Clés à exclure
 * @returns {Object} Nouvel objet sans les clés exclues
 */
const omit = (obj, keys) => {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
};

module.exports = {
  generateToken,
  generateId,
  sleep,
  formatDate,
  dateDiff,
  truncate,
  capitalize,
  slugify,
  isValidEmail,
  isValidUrl,
  maskString,
  hashString,
  paginate,
  paginationMeta,
  cleanObject,
  pick,
  omit
};