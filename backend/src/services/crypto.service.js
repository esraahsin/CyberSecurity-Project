/**
 * Service de cryptographie et hashing
 * Gère le chiffrement des données sensibles et le hashing des mots de passe
 * @module services/crypto.service
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration du chiffrement
const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');
const IV_LENGTH = 16;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Chiffre des données sensibles
 * @param {string} text - Texte à chiffrer
 * @returns {string} Texte chiffré (iv:authTag:encrypted)
 */
const encrypt = (text) => {
  try {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty');
    }

    // Génère un IV aléatoire pour chaque chiffrement
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Crée le cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    // Chiffre le texte
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Récupère l'auth tag pour GCM
    const authTag = cipher.getAuthTag();
    
    // Retourne: iv:authTag:encrypted (tout en hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Déchiffre des données
 * @param {string} encryptedData - Données chiffrées (format: iv:authTag:encrypted)
 * @returns {string} Texte déchiffré
 */
const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) {
      throw new Error('Encrypted data cannot be empty');
    }

    // Parse le format iv:authTag:encrypted
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    // Crée le decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    // Déchiffre
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Hash un mot de passe avec bcrypt
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Hash du mot de passe
 */
const hashPassword = async (password) => {
  try {
    if (!password) {
      throw new Error('Password cannot be empty');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (password.length > 128) {
      throw new Error('Password too long');
    }

    // Génère le salt et hash
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
};

/**
 * Compare un mot de passe avec son hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash à comparer
 * @returns {Promise<boolean>} True si le mot de passe correspond
 */
const comparePassword = async (password, hash) => {
  try {
    if (!password || !hash) {
      return false;
    }

    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
};

/**
 * Génère un token aléatoire sécurisé
 * @param {number} length - Longueur en bytes (défaut: 32)
 * @returns {string} Token hexadécimal
 */
const generateToken = (length = 32) => {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

/**
 * Génère un token de session sécurisé
 * @returns {string} Token de session unique
 */
const generateSessionToken = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = generateToken(24);
  return `${timestamp}.${randomPart}`;
};

/**
 * Hash une chaîne avec SHA256
 * @param {string} data - Données à hasher
 * @returns {string} Hash hexadécimal
 */
const hashData = (data) => {
  try {
    if (!data) {
      throw new Error('Data to hash cannot be empty');
    }

    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  } catch (error) {
    throw new Error(`Hashing failed: ${error.message}`);
  }
};

/**
 * Génère un code OTP à 6 chiffres
 * @returns {string} Code OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Chiffre un objet JSON
 * @param {Object} data - Objet à chiffrer
 * @returns {string} Données chiffrées
 */
const encryptObject = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    return encrypt(jsonString);
  } catch (error) {
    throw new Error(`Object encryption failed: ${error.message}`);
  }
};

/**
 * Déchiffre un objet JSON
 * @param {string} encryptedData - Données chiffrées
 * @returns {Object} Objet déchiffré
 */
const decryptObject = (encryptedData) => {
  try {
    const jsonString = decrypt(encryptedData);
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Object decryption failed: ${error.message}`);
  }
};

/**
 * Vérifie la force d'un mot de passe
 * @param {string} password - Mot de passe à vérifier
 * @returns {Object} { strong: boolean, score: number, feedback: Array }
 */
const checkPasswordStrength = (password) => {
  const feedback = [];
  let score = 0;

  if (!password) {
    return { strong: false, score: 0, feedback: ['Password is required'] };
  }

  // Longueur
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Complexité
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Feedback
  if (password.length < 8) {
    feedback.push('Use at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters');
  }

  return {
    strong: score >= 5,
    score: Math.min(score, 7),
    feedback
  };
};

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  comparePassword,
  generateToken,
  generateSessionToken,
  hashData,
  generateOTP,
  encryptObject,
  decryptObject,
  checkPasswordStrength
};