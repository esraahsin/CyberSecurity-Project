// backend/src/services/mfa.service.js - FIXED VERSION
const redisClient = require('../config/redis');
const emailService = require('./email.service');
const crypto = require('crypto');
const logger = require('../utils/logger');

class MFAService {
  /**
   * Génère un code MFA à 6 chiffres
   */
  generateMFACode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Envoie un code MFA par email
   * @param {number} userId - ID de l'utilisateur
   * @param {string} email - Email de l'utilisateur
   * @param {string} userName - Nom de l'utilisateur
   */
  async sendMFACode(userId, email, userName) {
    try {
      console.log('\n📧 MFA Service: Generating code for user:', {
        userId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        userName
      });

      // Générer le code
      const code = this.generateMFACode();
      
      console.log('🔑 Generated MFA code:', code);
      
      // Stocker dans Redis avec expiration de 10 minutes
      const key = `mfa:${userId}`;
      
      // ✅ Ensure Redis is connected
      if (!redisClient.isOpen) {
        console.log('⚠️  Redis not connected, attempting to connect...');
        await redisClient.connect();
      }
      
      await redisClient.setEx(key, 600, code); // 600 secondes = 10 minutes
      
      console.log('✅ MFA code stored in Redis with key:', key);
      
      // Envoyer par email
      console.log('📤 Attempting to send email to:', email);
      const emailResult = await emailService.sendMFACode(email, code, userName);
      
      console.log('📧 Email service result:', emailResult);
      
      logger.info('MFA code generated and sent', { 
        userId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        success: emailResult.success,
        devMode: emailResult.devMode
      });
      
      return {
        success: true,
        message: emailResult.devMode 
          ? 'Verification code available in server console' 
          : 'Verification code sent to your email',
        expiresIn: 600,
        devMode: emailResult.devMode,
        code: emailResult.devMode ? code : undefined // Include code in response if dev mode
      };
    } catch (error) {
      console.error('❌ MFA Service Error:', error);
      logger.error('Failed to send MFA code', { 
        error: error.message, 
        userId,
        stack: error.stack 
      });
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Vérifie un code MFA
   * @param {number} userId - ID de l'utilisateur
   * @param {string} code - Code à vérifier
   */
  async verifyMFACode(userId, code) {
    try {
      console.log('\n🔍 Verifying MFA code for user:', userId);
      console.log('Provided code:', code);
      
      const key = `mfa:${userId}`;
      
      // ✅ Ensure Redis is connected
      if (!redisClient.isOpen) {
        console.log('⚠️  Redis not connected, attempting to connect...');
        await redisClient.connect();
      }
      
      const storedCode = await redisClient.get(key);
      
      console.log('Stored code:', storedCode);
      
      if (!storedCode) {
        console.log('❌ No code found in Redis (expired or never generated)');
        return {
          valid: false,
          error: 'Code expired or not found. Please request a new code.'
        };
      }
      
      if (storedCode !== code) {
        console.log('❌ Code mismatch');
        // Log tentative échouée
        await this.incrementFailedAttempts(userId);
        
        return {
          valid: false,
          error: 'Invalid verification code'
        };
      }
      
      console.log('✅ Code verified successfully');
      
      // Code valide - supprimer de Redis
      await redisClient.del(key);
      
      // Réinitialiser les tentatives échouées
      await this.resetFailedAttempts(userId);
      
      logger.info('MFA code verified successfully', { userId });
      
      return {
        valid: true,
        message: 'Verification successful'
      };
    } catch (error) {
      console.error('❌ MFA verification error:', error);
      logger.error('MFA verification error', { error: error.message, userId });
      throw new Error('Verification failed');
    }
  }

  /**
   * Incrémente le compteur de tentatives échouées
   */
  async incrementFailedAttempts(userId) {
    const key = `mfa:failed:${userId}`;
    
    // ✅ Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    const attempts = await redisClient.get(key);
    const newAttempts = (parseInt(attempts) || 0) + 1;
    
    // Bloquer après 5 tentatives pour 30 minutes
    if (newAttempts >= 5) {
      await redisClient.setEx(`mfa:locked:${userId}`, 1800, 'locked'); // 30 minutes
      logger.warn('User locked due to too many MFA attempts', { userId });
    }
    
    await redisClient.setEx(key, 600, newAttempts.toString());
  }

  /**
   * Réinitialise les tentatives échouées
   */
  async resetFailedAttempts(userId) {
    // ✅ Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    await redisClient.del(`mfa:failed:${userId}`);
    await redisClient.del(`mfa:locked:${userId}`);
  }

  /**
   * Vérifie si l'utilisateur est bloqué
   */
  async isUserLocked(userId) {
    // ✅ Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    const locked = await redisClient.get(`mfa:locked:${userId}`);
    return !!locked;
  }

  /**
   * Renvoie un nouveau code MFA
   */
  async resendMFACode(userId, email, userName) {
    // Vérifier si l'utilisateur est bloqué
    const isLocked = await this.isUserLocked(userId);
    if (isLocked) {
      throw new Error('Too many attempts. Please try again later.');
    }
    
    // Vérifier le rate limiting (max 3 envois par 10 minutes)
    const rateLimitKey = `mfa:ratelimit:${userId}`;
    
    // ✅ Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    const sendCount = await redisClient.get(rateLimitKey);
    
    if (sendCount && parseInt(sendCount) >= 3) {
      throw new Error('Too many requests. Please wait before requesting a new code.');
    }
    
    // Incrémenter le compteur
    const newCount = (parseInt(sendCount) || 0) + 1;
    await redisClient.setEx(rateLimitKey, 600, newCount.toString());
    
    // Envoyer un nouveau code
    return await this.sendMFACode(userId, email, userName);
  }

  /**
   * Vérifie si un code MFA existe pour un utilisateur
   */
  async hasPendingMFA(userId) {
    // ✅ Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    const key = `mfa:${userId}`;
    const code = await redisClient.get(key);
    return !!code;
  }

  /**
   * Nettoie tous les codes MFA expirés (appelé périodiquement)
   */
  async cleanupExpiredCodes() {
    // Redis gère automatiquement l'expiration avec setEx
    // Cette méthode est optionnelle et peut servir à des statistiques
    logger.info('MFA codes cleanup completed');
  }
}

module.exports = new MFAService();