/**
 * Service d'authentification - COMPLETE FIXED VERSION
 * @module services/auth.service
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const redisClient = require('../config/redis');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(userData) {
    const { email, username, password, firstName, lastName, phoneNumber, dateOfBirth } = userData;

    try {
      // Vérifier si l'email existe déjà
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }

      // Vérifier si le username existe déjà
      const usernameCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (usernameCheck.rows.length > 0) {
        throw new Error('Username already exists');
      }

      // Hasher le mot de passe
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Créer l'utilisateur
      const result = await pool.query(
        `INSERT INTO users (
          email, username, password_hash, first_name, last_name, 
          phone_number, date_of_birth, account_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING id, email, username, first_name, last_name, created_at`,
        [email, username, passwordHash, firstName, lastName, phoneNumber, dateOfBirth]
      );

      const user = result.rows[0];

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      };

    } catch (error) {
      logger.error('Registration error', { error: error.message });
      throw error;
    }
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(emailOrUsername, password, ipAddress = '0.0.0.0') {
    try {
      // Rechercher l'utilisateur
      const result = await pool.query(
        `SELECT id, email, username, password_hash, first_name, last_name, 
                account_status, failed_login_attempts, account_locked_until, mfa_enabled, role
         FROM users 
         WHERE email = $1 OR username = $1`,
        [emailOrUsername]
      );

      if (result.rows.length === 0) {
        await this._logFailedLogin(emailOrUsername, ipAddress);
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Vérifier si le compte est verrouillé
      if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
        throw new Error('Account is locked. Please try again later.');
      }

      // Vérifier si le compte est actif
      if (user.account_status !== 'active') {
        throw new Error('Account is not active');
      }

      // Vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        await this._incrementFailedAttempts(user.id);
        await this._logFailedLogin(emailOrUsername, ipAddress);
        throw new Error('Invalid credentials');
      }

      // Réinitialiser les tentatives échouées
      await this._resetFailedAttempts(user.id);

      // Invalider toutes les anciennes sessions/tokens
      await this._invalidateOldUserTokens(user.id);

      // Générer de NOUVEAUX tokens
      const accessToken = this.generateJWT(user);
      const refreshToken = this.generateRefreshToken(user);

      // Stocker le nouveau refresh token dans Redis
      await redisClient.setEx(
        `refresh:${user.id}`,
        7 * 24 * 60 * 60, // 7 jours
        refreshToken
      );

      // Mettre à jour la dernière connexion
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email,
        ipAddress 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          mfaEnabled: user.mfa_enabled,
          role: user.role
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Login error', { error: error.message });
      throw error;
    }
  }

  /**
   * Génère un access token JWT
   */
  generateJWT(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role || 'user',
      // Don't manually set iat - jwt.sign does it automatically
    };

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      issuer: 'securebank-api',
      audience: 'securebank-app'
    });
  }

  /**
   * Génère un refresh token JWT
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn,
      issuer: 'securebank-api',
      audience: 'securebank-app'
    });
  }

  /**
   * Vérifie un JWT token
   */
  async verifyJWT(token) {
    try {
      // Vérifier si le token est en blacklist
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Vérifier le token
      const decoded = jwt.verify(token, jwtConfig.secret, {
        issuer: 'securebank-api',
        audience: 'securebank-app'
      });

      return decoded;

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Rafraîchit l'access token avec un refresh token
   */
  async refreshToken(refreshToken) {
    try {
      // Vérifier le refresh token
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret, {
        issuer: 'securebank-api',
        audience: 'securebank-app'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Vérifier si le refresh token stocké correspond
      const storedToken = await redisClient.get(`refresh:${decoded.userId}`);
      
      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      if (storedToken !== refreshToken) {
        throw new Error('Refresh token mismatch');
      }

      // Récupérer l'utilisateur
      const result = await pool.query(
        'SELECT id, email, username, account_status, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      if (user.account_status !== 'active') {
        throw new Error('Account is not active');
      }

      // Générer de NOUVEAUX tokens (rotation)
      const newAccessToken = this.generateJWT(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Mettre à jour le refresh token dans Redis
      await redisClient.setEx(
        `refresh:${user.id}`,
        7 * 24 * 60 * 60, // 7 jours
        newRefreshToken
      );

      logger.info('Token refreshed successfully', { userId: user.id });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };

    } catch (error) {
      logger.error('Token refresh error', { error: error.message });
      throw error;
    }
  }

  /**
   * Déconnexion - Blacklist le token
   */
  async logout(token) {
    try {
      // Décoder le token pour obtenir l'expiration
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token');
      }

      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      // Blacklister l'access token
      if (expiresIn > 0) {
        await this._blacklistToken(token, expiresIn);
      }

      // Supprimer aussi le refresh token
      await redisClient.del(`refresh:${decoded.userId}`);
      await redisClient.del(`session:${decoded.userId}`);

      logger.info('User logged out', { userId: decoded.userId });

    } catch (error) {
      logger.error('Logout error', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalide tous les anciens tokens d'un utilisateur
   * @private
   */
  async _invalidateOldUserTokens(userId) {
    try {
      // Supprimer l'ancien refresh token
      await redisClient.del(`refresh:${userId}`);
      
      // Supprimer toutes les sessions actives de l'utilisateur
      await redisClient.del(`session:${userId}`);
      
      logger.info('Old tokens invalidated for user', { userId });
    } catch (error) {
      logger.error('Error invalidating old tokens', { error: error.message, userId });
      // Ne pas throw - ce n'est pas critique
    }
  }

  /**
   * Ajoute un token à la blacklist dans Redis
   * @private
   */
  async _blacklistToken(token, expiresIn) {
    await redisClient.setEx(
      `blacklist:${token}`,
      expiresIn,
      'revoked'
    );
  }

  /**
   * Incrémente les tentatives de connexion échouées
   * @private
   */
  async _incrementFailedAttempts(userId) {
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockDuration = parseInt(process.env.ACCOUNT_LOCK_DURATION) || 30;

    const result = await pool.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1,
           account_locked_until = CASE 
             WHEN failed_login_attempts + 1 >= $2 
             THEN CURRENT_TIMESTAMP + INTERVAL '${lockDuration} minutes'
             ELSE account_locked_until
           END
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId, maxAttempts]
    );

    if (result.rows && result.rows.length > 0 && result.rows[0].failed_login_attempts >= maxAttempts) {
      logger.warn('Account locked due to too many failed attempts', { userId });
    }
  }

  /**
   * Réinitialise les tentatives échouées
   * @private
   */
  async _resetFailedAttempts(userId) {
    await pool.query(
      `UPDATE users 
       SET failed_login_attempts = 0,
           account_locked_until = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Log une tentative de connexion échouée
   * @private
   */
  async _logFailedLogin(emailOrUsername, ipAddress) {
    logger.warn('Failed login attempt', {
      emailOrUsername,
      ipAddress,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AuthService();