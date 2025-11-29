/**
 * Model Session - Gestion des sessions utilisateurs
 * @module models/Session.model
 */

const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

class SessionModel {
  /**
   * CREATE - Crée une nouvelle session
   */
  async create(sessionData) {
    const {
      userId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresIn = 600000 // 10 minutes par défaut
    } = sessionData;

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresIn);

    const query = `
      INSERT INTO sessions (
        session_id, user_id, access_token, refresh_token,
        ip_address, user_agent, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, session_id, user_id, ip_address,
        is_active, created_at, expires_at
    `;

    const values = [
      sessionId,
      userId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt
    ];

    try {
      const result = await pool.query(query, values);
      logger.info('Session created', { sessionId, userId, ipAddress });
      return result.rows[0];
    } catch (error) {
      logger.error('Session creation failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * READ - Trouve une session par ID
   */
  async findById(id) {
    const query = `
      SELECT 
        s.*,
        u.email, u.first_name, u.last_name, u.account_status
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve une session par session_id
   */
  async findBySessionId(sessionId) {
    const query = `
      SELECT *
      FROM sessions
      WHERE session_id = $1
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve toutes les sessions actives d'un utilisateur
   */
  async findActiveByUserId(userId) {
    const query = `
      SELECT 
        id, session_id, ip_address, user_agent,
        created_at, last_activity, expires_at,
        is_suspicious, mfa_verified
      FROM sessions
      WHERE user_id = $1
      AND is_active = true
      AND expires_at > NOW()
      ORDER BY last_activity DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * UPDATE - Met à jour la dernière activité
   */
  async updateActivity(sessionId) {
    const query = `
      UPDATE sessions
      SET last_activity = NOW()
      WHERE session_id = $1
      AND is_active = true
      RETURNING id, session_id, last_activity
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  /**
   * UPDATE - Vérifie MFA pour la session
   */
  async verifyMFA(sessionId) {
    const query = `
      UPDATE sessions
      SET 
        mfa_verified = true,
        mfa_verified_at = NOW()
      WHERE session_id = $1
      RETURNING id, session_id, mfa_verified
    `;

    const result = await pool.query(query, [sessionId]);

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return result.rows[0];
  }

  /**
   * UPDATE - Marque une session comme suspecte
   */
  async markSuspicious(sessionId, reason) {
    const query = `
      UPDATE sessions
      SET 
        is_suspicious = true,
        suspicious_reason = $1
      WHERE session_id = $2
      RETURNING id, session_id, is_suspicious
    `;

    const result = await pool.query(query, [reason, sessionId]);

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    logger.warn('Session marked suspicious', { sessionId, reason });
    return result.rows[0];
  }

  /**
   * DELETE - Invalide une session (logout)
   */
  async invalidate(sessionId) {
    const query = `
      UPDATE sessions
      SET is_active = false
      WHERE session_id = $1
      RETURNING id, session_id, is_active
    `;

    const result = await pool.query(query, [sessionId]);

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    logger.info('Session invalidated', { sessionId });
    return result.rows[0];
  }

  /**
   * DELETE - Invalide toutes les sessions d'un utilisateur
   */
  async invalidateAllByUserId(userId) {
    const query = `
      UPDATE sessions
      SET is_active = false
      WHERE user_id = $1
      AND is_active = true
      RETURNING COUNT(*) as count
    `;

    const result = await pool.query(query, [userId]);
    logger.info('All sessions invalidated', { userId });
    return parseInt(result.rows[0]?.count || 0);
  }

  /**
   * DELETE - Nettoie les sessions expirées
   */
  async cleanupExpired() {
    const query = `
      UPDATE sessions
      SET is_active = false
      WHERE expires_at < NOW()
      AND is_active = true
      RETURNING COUNT(*) as count
    `;

    const result = await pool.query(query);
    const count = parseInt(result.rows[0]?.count || 0);

    if (count > 0) {
      logger.info('Expired sessions cleaned up', { count });
    }

    return count;
  }
}

// ============================================================

/**
 * Model Beneficiary - Gestion des bénéficiaires
 * @module models/Beneficiary.model
 */

class BeneficiaryModel {
  /**
   * CREATE - Ajoute un nouveau bénéficiaire
   */
  async create(beneficiaryData) {
    const {
      userId,
      beneficiaryName,
      accountNumber,
      bankName,
      bankCode,
      swiftCode,
      iban,
      beneficiaryType = 'personal',
      category,
      nickname
    } = beneficiaryData;

    const query = `
      INSERT INTO beneficiaries (
        user_id, beneficiary_name, account_number,
        bank_name, bank_code, swift_code, iban,
        beneficiary_type, category, nickname
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      userId,
      beneficiaryName,
      accountNumber,
      bankName,
      bankCode,
      swiftCode,
      iban,
      beneficiaryType,
      category,
      nickname
    ];

    try {
      const result = await pool.query(query, values);
      logger.info('Beneficiary created', { 
        beneficiaryId: result.rows[0].id, 
        userId,
        accountNumber 
      });
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Beneficiary already exists for this account');
      }
      throw error;
    }
  }

  /**
   * READ - Trouve un bénéficiaire par ID
   */
  async findById(id) {
    const query = 'SELECT * FROM beneficiaries WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * READ - Liste tous les bénéficiaires d'un utilisateur
   */
  async findByUserId(userId, options = {}) {
    const { isActive = true, isFavorite } = options;

    let query = `
      SELECT 
        id, beneficiary_name, account_number,
        bank_name, swift_code, iban,
        beneficiary_type, category, nickname,
        is_verified, is_active, is_favorite,
        total_transfers, total_amount_transferred,
        last_transfer_at, created_at
      FROM beneficiaries
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    if (isFavorite !== undefined) {
      query += ` AND is_favorite = $${paramIndex}`;
      params.push(isFavorite);
      paramIndex++;
    }

    query += ' ORDER BY is_favorite DESC, beneficiary_name ASC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * UPDATE - Met à jour un bénéficiaire
   */
  async update(id, updates) {
    const allowedFields = [
      'beneficiary_name', 'bank_name', 'nickname',
      'category', 'is_favorite', 'is_active'
    ];

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = NOW()');

    const query = `
      UPDATE beneficiaries
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.info('Beneficiary updated', { beneficiaryId: id });
    return result.rows[0];
  }

  /**
   * UPDATE - Vérifie un bénéficiaire
   */
  async verify(id, verificationMethod) {
    const query = `
      UPDATE beneficiaries
      SET 
        is_verified = true,
        verification_method = $1,
        verified_at = NOW()
      WHERE id = $2
      RETURNING id, beneficiary_name, is_verified
    `;

    const result = await pool.query(query, [verificationMethod, id]);

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.info('Beneficiary verified', { beneficiaryId: id });
    return result.rows[0];
  }

  /**
   * UPDATE - Met à jour les statistiques après un transfert
   */
  async updateStats(id, amount) {
    const query = `
      UPDATE beneficiaries
      SET 
        total_transfers = total_transfers + 1,
        total_amount_transferred = total_amount_transferred + $1,
        last_transfer_at = NOW()
      WHERE id = $2
      RETURNING id, total_transfers, total_amount_transferred
    `;

    const result = await pool.query(query, [amount, id]);

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    return result.rows[0];
  }

  /**
   * DELETE - Supprime un bénéficiaire (soft delete)
   */
  async delete(id) {
    const query = `
      UPDATE beneficiaries
      SET is_active = false
      WHERE id = $1
      RETURNING id, beneficiary_name, is_active
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.info('Beneficiary deleted', { beneficiaryId: id });
    return result.rows[0];
  }

  /**
   * DELETE - Supprime définitivement un bénéficiaire
   */
  async hardDelete(id) {
    const query = 'DELETE FROM beneficiaries WHERE id = $1 RETURNING id, beneficiary_name';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    logger.warn('Beneficiary permanently deleted', { beneficiaryId: id });
    return result.rows[0];
  }

  /**
   * Recherche de bénéficiaires
   */
  async search(userId, searchTerm) {
    const query = `
      SELECT *
      FROM beneficiaries
      WHERE user_id = $1
      AND is_active = true
      AND (
        beneficiary_name ILIKE $2
        OR account_number ILIKE $2
        OR nickname ILIKE $2
      )
      ORDER BY beneficiary_name ASC
      LIMIT 20
    `;

    const result = await pool.query(query, [userId, `%${searchTerm}%`]);
    return result.rows;
  }
}

module.exports = {
  SessionModel: new SessionModel(),
};