/**
 * Configuration du chiffrement des données sensibles
 * @module config/encryption
 */

const crypto = require('crypto');
require('dotenv').config();

// Clé de chiffrement (doit être en .env en production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16; // Pour AES, l'IV doit faire 16 bytes
const ALGORITHM = 'aes-256-gcm';

/**
 * Chiffre des données sensibles
 * @param {string} text - Texte à chiffrer
 * @returns {string} Texte chiffré (format: iv:authTag:encrypted)
 */
const encrypt = (text) => {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Déchiffre des données
 * @param {string} encryptedData - Données chiffrées
 * @returns {string} Texte déchiffré
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Hash une donnée avec SHA256
 * @param {string} data - Donnée à hasher
 * @returns {string} Hash hexadécimal
 */
const hash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Génère une clé de chiffrement aléatoire
 * @returns {string} Clé hexadécimale
 */
const generateKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Masque une donnée sensible (ex: carte bancaire)
 * @param {string} data - Donnée à masquer
 * @param {number} visibleStart - Caractères visibles au début
 * @param {number} visibleEnd - Caractères visibles à la fin
 * @returns {string} Donnée masquée
 */
const mask = (data, visibleStart = 4, visibleEnd = 4) => {
  if (!data || data.length <= visibleStart + visibleEnd) {
    return data;
  }

  const start = data.substring(0, visibleStart);
  const end = data.substring(data.length - visibleEnd);
  const masked = '*'.repeat(data.length - visibleStart - visibleEnd);

  return `${start}${masked}${end}`;
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateKey,
  mask,
  ENCRYPTION_KEY: ENCRYPTION_KEY.toString('hex')
};