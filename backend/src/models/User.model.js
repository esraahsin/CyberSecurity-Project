/**
 * Model User - Gestion des utilisateurs
 * @module models/User.model
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class UserModel {
  /**
   * CREATE - Crée un nouvel utilisateur
   */
  async create(userData) {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth
    } = userData;

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    const query = `
      INSERT INTO users (
        email, username, password_hash,
        first_name, last_name, phone_number, date_of_birth
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, email, username, first_name, last_name,
        phone_number, date_of_birth, role, account_status,
        created_at
    `;

    const values = [
      email.toLowerCase(),
      username,
      passwordHash,
      firstName,
      lastName,
      phoneNumber || null,
      dateOfBirth || null
    ];

    try {
      const result = await pool.query(query, values);
      logger.info('User created', { userId: result.rows[0].id, email });
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
      }
      throw error;
    }
  }

  /**
   * READ - Trouve un utilisateur par ID
   */
  async findById(id) {
    const query = `
      SELECT 
        id, email, username, first_name, last_name,
        phone_number, date_of_birth, mfa_enabled, mfa_secret,
        email_verified, account_status, role,
        failed_login_attempts, account_locked_until,
        last_login, created_at, updated_at, last_password_change
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve un utilisateur par email
   */
  async findByEmail(email) {
    const query = `
      SELECT 
        id, email, username, password_hash,
        first_name, last_name, phone_number, date_of_birth,
        mfa_enabled, mfa_secret, email_verified, account_status, role,
        failed_login_attempts, account_locked_until,
        last_login, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
    `;

    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve un utilisateur par username
   */
  async findByUsername(username) {
    const query = `
      SELECT 
        id, email, username, password_hash,
        first_name, last_name, account_status, role
      FROM users
      WHERE username = $1
    `;

    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  /**
   * READ - Liste tous les utilisateurs (avec pagination)
   */
  async findAll(options = {}) {
    const { page = 1, limit = 20, status, role } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id, email, username, first_name, last_name,
        phone_number, account_status, role,
        email_verified, last_login, created_at
      FROM users
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND account_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Compter le total
    const countQuery = 'SELECT COUNT(*) as total FROM users';
    const countResult = await pool.query(countQuery);

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    };
  }

  /**
   * UPDATE - Met à jour un utilisateur
   */
  async update(id, updates) {
    const allowedFields = [
      'first_name', 'last_name', 'phone_number', 
      'date_of_birth', 'email_verified', 'account_status'
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
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, email, username, first_name, last_name,
        phone_number, date_of_birth, email_verified,
        account_status, updated_at
    `;

    values.push(id);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User updated', { userId: id, fields: Object.keys(updates) });
    return result.rows[0];
  }

  /**
   * UPDATE - Met à jour le mot de passe
   */
  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const query = `
      UPDATE users
      SET 
        password_hash = $1,
        last_password_change = NOW(),
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, email
    `;

    const result = await pool.query(query, [passwordHash, id]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('Password updated', { userId: id });
    return result.rows[0];
  }

  /**
   * UPDATE - Active/Désactive MFA
   */
  async updateMFA(id, mfaEnabled, mfaSecret = null) {
    const query = `
      UPDATE users
      SET 
        mfa_enabled = $1,
        mfa_secret = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, mfa_enabled
    `;

    const result = await pool.query(query, [mfaEnabled, mfaSecret, id]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('MFA updated', { userId: id, mfaEnabled });
    return result.rows[0];
  }

  /**
   * UPDATE - Gère les tentatives de connexion échouées
   */
  async incrementFailedLogins(id) {
    const query = `
      UPDATE users
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        account_locked_until = CASE 
          WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
          ELSE NULL
        END
      WHERE id = $1
      RETURNING id, failed_login_attempts, account_locked_until
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * UPDATE - Réinitialise les tentatives de connexion
   */
  async resetFailedLogins(id) {
    const query = `
      UPDATE users
      SET 
        failed_login_attempts = 0,
        account_locked_until = NULL,
        last_login = NOW()
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * DELETE - Supprime un utilisateur (soft delete)
   */
  async delete(id) {
    const query = `
      UPDATE users
      SET 
        account_status = 'closed',
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, account_status
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User deleted (soft)', { userId: id });
    return result.rows[0];
  }

  /**
   * DELETE - Supprime définitivement un utilisateur (hard delete)
   */
  async hardDelete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id, email';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.warn('User permanently deleted', { userId: id });
    return result.rows[0];
  }

  /**
   * Vérifie le mot de passe
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Vérifie si un utilisateur existe
   */
  async exists(email) {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))';
    const result = await pool.query(query, [email]);
    return result.rows[0].exists;
  }
}

module.exports = new UserModel();