/**
 * Service de gestion des sessions utilisateurs
 * Gère les sessions actives, la validation et la sécurité
 * @module services/session.service
 */

const crypto = require('crypto');
const pool = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class SessionService {
  /**
   * Crée une nouvelle session utilisateur
   * @param {Object} sessionData - Données de session
   * @returns {Promise<Object>} Session créée
   */
  async createSession(sessionData) {
    const {
      userId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      deviceInfo = {},
      mfaVerified = false
    } = sessionData;

    try {
      // Générer un ID de session unique
      const sessionId = this._generateSessionId();

      // Calculer l'expiration (15 minutes par défaut)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Extraire les informations de localisation (si disponibles)
      const { country = null, city = null } = deviceInfo;

      // Créer la session en base de données
      const result = await pool.query(
        `INSERT INTO sessions (
          session_id, user_id, access_token, refresh_token,
          ip_address, user_agent, device_info,
          country, city, is_active, mfa_verified, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
        RETURNING id, session_id, created_at, expires_at`,
        [
          sessionId,
          userId,
          accessToken,
          refreshToken,
          ipAddress,
          userAgent,
          JSON.stringify(deviceInfo),
          country,
          city,
          mfaVerified,
          expiresAt
        ]
      );

      const session = result.rows[0];

      // Stocker la session dans Redis pour un accès rapide
      await this._cacheSession(sessionId, {
        userId,
        ipAddress,
        expiresAt: expiresAt.toISOString(),
        mfaVerified
      });

      logger.info('Session created', {
        userId,
        sessionId,
        ipAddress
      });

      return {
        sessionId: session.session_id,
        expiresAt: session.expires_at,
        createdAt: session.created_at
      };

    } catch (error) {
      logger.error('Session creation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Valide une session existante
   * @param {string} sessionId - ID de session
   * @returns {Promise<Object>} Session valide
   */
  async validateSession(sessionId) {
    try {
      // Vérifier d'abord dans le cache Redis
      const cachedSession = await this._getCachedSession(sessionId);
      
      if (cachedSession) {
        // Vérifier l'expiration
        if (new Date(cachedSession.expiresAt) < new Date()) {
          await this.endSession(sessionId);
          throw new Error('Session expired');
        }
        return cachedSession;
      }

      // Si pas en cache, chercher en base de données
      const result = await pool.query(
        `SELECT session_id, user_id, ip_address, is_active, 
                mfa_verified, expires_at, last_activity
         FROM sessions 
         WHERE session_id = $1 AND is_active = true`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found or inactive');
      }

      const session = result.rows[0];

      // Vérifier l'expiration
      if (new Date(session.expires_at) < new Date()) {
        await this.endSession(sessionId);
        throw new Error('Session expired');
      }

      // Mettre à jour l'activité
      await this._updateActivity(sessionId);

      // Recacher la session
      await this._cacheSession(sessionId, {
        userId: session.user_id,
        ipAddress: session.ip_address,
        expiresAt: session.expires_at.toISOString(),
        mfaVerified: session.mfa_verified
      });

      return {
        sessionId: session.session_id,
        userId: session.user_id,
        ipAddress: session.ip_address,
        mfaVerified: session.mfa_verified,
        expiresAt: session.expires_at
      };

    } catch (error) {
      logger.error('Session validation error', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Rafraîchit une session (prolonge l'expiration)
   * @param {string} sessionId - ID de session
   * @returns {Promise<Object>} Session mise à jour
   */
  async refreshSession(sessionId) {
    try {
      // Nouvelle expiration (15 minutes)
      const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const result = await pool.query(
        `UPDATE sessions 
         SET expires_at = $2, last_activity = CURRENT_TIMESTAMP
         WHERE session_id = $1 AND is_active = true
         RETURNING session_id, expires_at`,
        [sessionId, newExpiresAt]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found or inactive');
      }

      // Mettre à jour le cache
      const cachedSession = await this._getCachedSession(sessionId);
      if (cachedSession) {
        cachedSession.expiresAt = newExpiresAt.toISOString();
        await this._cacheSession(sessionId, cachedSession);
      }

      logger.info('Session refreshed', { sessionId });

      return {
        sessionId: result.rows[0].session_id,
        expiresAt: result.rows[0].expires_at
      };

    } catch (error) {
      logger.error('Session refresh error', { error: error.message });
      throw error;
    }
  }

  /**
   * Termine une session
   * @param {string} sessionId - ID de session
   * @returns {Promise<void>}
   */
  async endSession(sessionId) {
    try {
      await pool.query(
        'UPDATE sessions SET is_active = false WHERE session_id = $1',
        [sessionId]
      );

      // Supprimer du cache
      await redisClient.del(`session:${sessionId}`);

      logger.info('Session ended', { sessionId });

    } catch (error) {
      logger.error('Session end error', { error: error.message });
      throw error;
    }
  }

  /**
   * Termine toutes les sessions d'un utilisateur
   * @param {number} userId - ID utilisateur
   * @param {string} exceptSessionId - Session à ne pas terminer (optionnel)
   * @returns {Promise<number>} Nombre de sessions terminées
   */
  async endAllUserSessions(userId, exceptSessionId = null) {
    try {
      let query = 'UPDATE sessions SET is_active = false WHERE user_id = $1';
      const params = [userId];

      if (exceptSessionId) {
        query += ' AND session_id != $2';
        params.push(exceptSessionId);
      }

      const result = await pool.query(query, params);

      // Nettoyer le cache Redis
      const sessions = await pool.query(
        'SELECT session_id FROM sessions WHERE user_id = $1',
        [userId]
      );

      for (const session of sessions.rows) {
        if (session.session_id !== exceptSessionId) {
          await redisClient.del(`session:${session.session_id}`);
        }
      }

      logger.info('All user sessions ended', { 
        userId, 
        count: result.rowCount 
      });

      return result.rowCount;

    } catch (error) {
      logger.error('End all sessions error', { error: error.message });
      throw error;
    }
  }

  /**
   * Récupère toutes les sessions actives d'un utilisateur
   * @param {number} userId - ID utilisateur
   * @returns {Promise<Array>} Liste des sessions
   */
  async getUserSessions(userId) {
    try {
      const result = await pool.query(
        `SELECT session_id, ip_address, user_agent, country, city,
                created_at, last_activity, expires_at, is_suspicious
         FROM sessions 
         WHERE user_id = $1 AND is_active = true
         ORDER BY last_activity DESC`,
        [userId]
      );

      return result.rows.map(session => ({
        sessionId: session.session_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        location: {
          country: session.country,
          city: session.city
        },
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        expiresAt: session.expires_at,
        isSuspicious: session.is_suspicious
      }));

    } catch (error) {
      logger.error('Get user sessions error', { error: error.message });
      throw error;
    }
  }

  /**
   * Marque une session comme suspecte
   * @param {string} sessionId - ID de session
   * @param {string} reason - Raison de suspicion
   * @returns {Promise<void>}
   */
  async markSessionSuspicious(sessionId, reason) {
    try {
      await pool.query(
        `UPDATE sessions 
         SET is_suspicious = true, suspicious_reason = $2
         WHERE session_id = $1`,
        [sessionId, reason]
      );

      logger.warn('Session marked as suspicious', { 
        sessionId, 
        reason 
      });

    } catch (error) {
      logger.error('Mark suspicious error', { error: error.message });
      throw error;
    }
  }

  /**
   * Nettoie les sessions expirées
   * @returns {Promise<number>} Nombre de sessions nettoyées
   */
  async cleanupExpiredSessions() {
    try {
      const result = await pool.query(
        'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP'
      );

      logger.info('Expired sessions cleaned', { 
        count: result.rowCount 
      });

      return result.rowCount;

    } catch (error) {
      logger.error('Session cleanup error', { error: error.message });
      throw error;
    }
  }

  /**
   * Vérifie si l'IP a changé pour une session
   * @param {string} sessionId - ID de session
   * @param {string} currentIp - IP actuelle
   * @returns {Promise<boolean>} True si l'IP a changé
   */
  async checkIpChange(sessionId, currentIp) {
    try {
      const result = await pool.query(
        'SELECT ip_address FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const originalIp = result.rows[0].ip_address;
      const hasChanged = originalIp !== currentIp;

      if (hasChanged) {
        logger.warn('IP address changed for session', {
          sessionId,
          originalIp,
          currentIp
        });
      }

      return hasChanged;

    } catch (error) {
      logger.error('IP check error', { error: error.message });
      throw error;
    }
  }

  // ==================== Méthodes privées ====================

  /**
   * Génère un ID de session sécurisé
   * @private
   */
  _generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Met en cache une session dans Redis
   * @private
   */
  async _cacheSession(sessionId, sessionData) {
    const key = `session:${sessionId}`;
    // Expiration de 30 minutes en cache
    await redisClient.setEx(key, 1800, JSON.stringify(sessionData));
  }

  /**
   * Récupère une session du cache Redis
   * @private
   */
  async _getCachedSession(sessionId) {
    const key = `session:${sessionId}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Met à jour l'activité d'une session
   * @private
   */
  async _updateActivity(sessionId) {
    await pool.query(
      'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = $1',
      [sessionId]
    );
  }
}

module.exports = new SessionService();