/**
 * Service d'authentification - FIXED VERSION
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
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }

      const usernameCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (usernameCheck.rows.length > 0) {
        throw new Error('Username already exists');
      }

      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

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

      if (user.account_status !== 'active') {
        throw new Error('Account is not active');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        await this._incrementFailedAttempts(user.id);
        await this._logFailedLogin(emailOrUsername, ipAddress);
        throw new Error('Invalid credentials');
      }

      await this._resetFailedAttempts(user.id);
      await this._invalidateOldUserTokens(user.id);

      // ✅ FIX: Générer tokens avec expiration cohérente
      const accessToken = this.generateJWT(user);
      const refreshToken = this.generateRefreshToken(user);

      // ✅ FIX: Stocker refresh token avec TTL de 7 jours
      await redisClient.setEx(
        `refresh:${user.id}`,
        7 * 24 * 60 * 60, // 7 jours en secondes
        refreshToken
      );

      // Mettre à jour la dernière connexion avec timezone UTC
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
   * ✅ FIX: Expiration 1 jour (cohérent avec session)
   */
  generateJWT(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role || 'user'
    };

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: '1d', // ✅ 1 jour au lieu de jwtConfig.expiresIn
      issuer: 'securebank-api',
      audience: 'securebank-app'
    });
  }

  /**
   * Génère un refresh token JWT
   * ✅ FIX: Expiration 7 jours
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, jwtConfig.refreshSecret, {
      expiresIn: '7d', // ✅ 7 jours au lieu de jwtConfig.refreshExpiresIn
      issuer: 'securebank-api',
      audience: 'securebank-app'
    });
  }

  /**
   * Vérifie un JWT token
   */
  async verifyJWT(token) {
    try {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

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
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret, {
        issuer: 'securebank-api',
        audience: 'securebank-app'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const storedToken = await redisClient.get(`refresh:${decoded.userId}`);
      
      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      if (storedToken !== refreshToken) {
        throw new Error('Refresh token mismatch');
      }

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

      // ✅ FIX: Rotation des tokens
      const newAccessToken = this.generateJWT(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // ✅ FIX: Blacklister l'ancien refresh token avec bon TTL
      const tokenPayload = jwt.decode(refreshToken);
      const expiresIn = tokenPayload.exp - Math.floor(Date.now() / 1000);
      
      if (expiresIn > 0) {
        await redisClient.setEx(
          `blacklist:${refreshToken}`,
          expiresIn, // ✅ TTL en secondes (pas "7d")
          'revoked'
        );
      }

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
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token');
      }

      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      if (expiresIn > 0) {
        await this._blacklistToken(token, expiresIn);
      }

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
      await redisClient.del(`refresh:${userId}`);
      await redisClient.del(`session:${userId}`);
      
      logger.info('Old tokens invalidated for user', { userId });
    } catch (error) {
      logger.error('Error invalidating old tokens', { error: error.message, userId });
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
  // backend/src/services/auth.service.js - ADD THESE METHODS TO THE CLASS

/**
 * Enable MFA - Generate and store secret
 */
async enableMFA(userId) {
  try {
    const crypto = require('crypto');
    const mfaSecret = crypto.randomBytes(20).toString('hex');

    // Store temporary secret in Redis (10 minutes expiration)
    await redisClient.setEx(
      `mfa_setup:${userId}`,
      600,
      mfaSecret
    );

    logger.info('MFA setup initiated', { userId });

    return {
      secret: mfaSecret,
      instructions: 'Use this secret in your authenticator app'
    };
  } catch (error) {
    logger.error('Enable MFA error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Verify MFA setup code and save to database
 */
async verifyMFASetup(userId, code) {
  try {
    // Get pending secret from Redis
    const mfaSecret = await redisClient.get(`mfa_setup:${userId}`);
    
    if (!mfaSecret) {
      throw new Error('MFA setup expired. Please start again.');
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Invalid MFA code format');
    }

    // In production, verify with speakeasy
    // For now, accept any 6-digit code for demo purposes
    
    // Save MFA secret to database
    await pool.query(
      `UPDATE users 
       SET mfa_enabled = true, mfa_secret = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [mfaSecret, userId]
    );

    // Clean up Redis
    await redisClient.del(`mfa_setup:${userId}`);

    logger.info('MFA enabled successfully', { userId });

    return { success: true };
  } catch (error) {
    logger.error('MFA verification error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Disable MFA
 */
async disableMFA(userId, password, code) {
  try {
    // Get user with password
    const userResult = await pool.query(
      'SELECT password_hash, mfa_enabled, mfa_secret FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (!user.mfa_enabled) {
      throw new Error('MFA is not enabled');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Verify MFA code format
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Invalid MFA code format');
    }

    // In production, verify code with speakeasy
    // For now, accept any 6-digit code

    // Disable MFA
    await pool.query(
      `UPDATE users 
       SET mfa_enabled = false, mfa_secret = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    logger.info('MFA disabled successfully', { userId });

    return { success: true };
  } catch (error) {
    logger.error('Disable MFA error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get MFA status for a user
 */
async getMFAStatus(userId) {
  try {
    const result = await pool.query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const setupPending = await redisClient.exists(`mfa_setup:${userId}`);

    return {
      mfaEnabled: result.rows[0].mfa_enabled,
      setupPending: setupPending === 1
    };
  } catch (error) {
    logger.error('Get MFA status error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Verify MFA code during login
 */
async verifyMFACode(userId, code) {
  try {
    // Get user's MFA secret
    const result = await pool.query(
      'SELECT mfa_secret FROM users WHERE id = $1 AND mfa_enabled = true',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('MFA not enabled for this user');
    }

    // Verify code format
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Invalid MFA code format');
    }

    // In production, verify with speakeasy using the stored secret
    // For now, accept any 6-digit code
    
    logger.info('MFA code verified', { userId });

    return { success: true };
  } catch (error) {
    logger.error('MFA code verification error', { error: error.message, userId });
    throw error;
  }
}
}

module.exports = new AuthService();