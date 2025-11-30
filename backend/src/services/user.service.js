/**
 * Service de gestion des utilisateurs - COMPLETE
 * @module services/user.service
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

class UserService {
  /**
   * Récupère un utilisateur par ID
   */
  async getUserById(userId) {
    const result = await pool.query(`
      SELECT 
        id, email, username, first_name, last_name,
        phone_number, date_of_birth, mfa_enabled,
        email_verified, account_status, role,
        created_at, last_login, last_password_change
      FROM users
      WHERE id = $1 AND account_status != 'closed'
    `, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
  }

  /**
   * Liste tous les utilisateurs avec pagination
   */
  async listUsers(options = {}) {
    const { page = 1, limit = 20, status, role } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id, email, username, first_name, last_name,
        phone_number, account_status, role,
        email_verified, created_at, last_login
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
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    
    if (status) {
      countQuery += ' AND account_status = $1';
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    };
  }
  
  /**
   * Met à jour le profil utilisateur
   */
  async updateProfile(userId, updates) {
    const allowedFields = [
      'first_name',
      'last_name',
      'phone_number',
      'date_of_birth'
    ];
    
    const validUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const fields = Object.keys(validUpdates);
    const values = Object.values(validUpdates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE users
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING id, email, username, first_name, last_name, phone_number
    `;
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    logger.info('Profile updated', { userId, fields });
    
    return result.rows[0];
  }
  
  /**
   * Change le mot de passe utilisateur
   */
  async changePassword(userId, currentPassword, newPassword) {
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const isValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );
    
    if (!isValid) {
      logger.logSecurity('FAILED_PASSWORD_CHANGE', { userId });
      throw new Error('Current password is incorrect');
    }
    
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await pool.query(`
      UPDATE users
      SET password_hash = $1, last_password_change = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, userId]);
    
    logger.info('Password changed successfully', { userId });
    
    return { success: true, message: 'Password changed successfully' };
  }
  
  /**
   * Supprime un utilisateur (soft delete)
   */
  async deleteUser(userId) {
    const result = await pool.query(`
      UPDATE users
      SET account_status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User deleted', { userId });
    return result.rows[0];
  }
  
  /**
   * Récupère tous les comptes d'un utilisateur
   */
  async getUserAccounts(userId) {
    const result = await pool.query(`
      SELECT 
        id, account_number, account_type, currency,
        balance, available_balance, account_status,
        daily_transfer_limit, created_at, last_transaction_at
      FROM accounts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    
    return result.rows;
  }
  
  /**
   * Récupère les statistiques utilisateur
   */
  async getUserStats(userId) {
    const accountsCount = await pool.query(
      'SELECT COUNT(*) as count FROM accounts WHERE user_id = $1',
      [userId]
    );
    
    const transactionsCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions t
      INNER JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
      WHERE a.user_id = $1
    `, [userId]);
    
    const totalBalance = await pool.query(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = $1',
      [userId]
    );
    
    const lastLogin = await pool.query(
      'SELECT last_login FROM users WHERE id = $1',
      [userId]
    );
    
    return {
      totalAccounts: parseInt(accountsCount.rows[0].count),
      totalTransactions: parseInt(transactionsCount.rows[0].count),
      totalBalance: parseInt(totalBalance.rows[0].total) / 100,
      lastLogin: lastLogin.rows[0]?.last_login
    };
  }

  /**
   * Change le rôle d'un utilisateur
   */
  async updateUserRole(userId, role) {
    const result = await pool.query(`
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, role
    `, [role, userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User role updated', { userId, newRole: role });
    return result.rows[0];
  }

  /**
   * Change le statut d'un utilisateur
   */
  async updateUserStatus(userId, status) {
    const result = await pool.query(`
      UPDATE users
      SET account_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, account_status
    `, [status, userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User status updated', { userId, newStatus: status });
    return result.rows[0];
  }

  /**
   * Déverrouille un utilisateur
   */
  async unlockUser(userId) {
    const result = await pool.query(`
      UPDATE users
      SET 
        failed_login_attempts = 0,
        account_locked_until = NULL,
        account_status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User unlocked', { userId });
    return result.rows[0];
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur
   */
  async resetUserPassword(userId) {
    // Générer un mot de passe temporaire
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await pool.query(`
      UPDATE users
      SET 
        password_hash = $1,
        last_password_change = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, userId]);

    logger.info('Password reset by admin', { userId });
    
    // Retourner le mot de passe temporaire (à envoyer à l'utilisateur)
    return tempPassword;
  }

  /**
   * Recherche d'utilisateurs
   */
  async searchUsers(searchTerm, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id, email, username, first_name, last_name,
        account_status, role, created_at
      FROM users
      WHERE (
        email ILIKE $1
        OR username ILIKE $1
        OR first_name ILIKE $1
        OR last_name ILIKE $1
      )
      AND account_status != 'closed'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [`%${searchTerm}%`, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE (
        email ILIKE $1
        OR username ILIKE $1
        OR first_name ILIKE $1
        OR last_name ILIKE $1
      )
      AND account_status != 'closed'
    `;

    const countResult = await pool.query(countQuery, [`%${searchTerm}%`]);

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    };
  }
  
  /**
   * Vérifie si l'utilisateur peut effectuer une action
   */
  async canPerformAction(userId, action) {
    const user = await this.getUserById(userId);
    
    if (user.account_status === 'suspended') {
      return { allowed: false, reason: 'Account is suspended' };
    }
    
    if (user.account_status === 'locked') {
      return { allowed: false, reason: 'Account is locked' };
    }
    
    if (!user.email_verified && action === 'transfer') {
      return { allowed: false, reason: 'Email must be verified' };
    }
    
    return { allowed: true };
  }
}

module.exports = new UserService();