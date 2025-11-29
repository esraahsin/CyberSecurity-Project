/**
 * Service de gestion des utilisateurs
 * @module services/user.service
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
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
        created_at, last_login
      FROM users
      WHERE id = $1 AND account_status != 'closed'
    `, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
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
    
    // Filtrer les champs autorisés
    const validUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    // Construire la requête dynamique
    const fields = Object.keys(validUpdates);
    const values = Object.values(validUpdates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE users
      SET ${setClause}, updated_at = NOW()
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
    // 1. Récupérer le hash actuel
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    // 2. Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );
    
    if (!isValid) {
      logger.logSecurity('FAILED_PASSWORD_CHANGE', { userId });
      throw new Error('Current password is incorrect');
    }
    
    // 3. Valider le nouveau mot de passe
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }
    
    // 4. Hasher et sauvegarder
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await pool.query(`
      UPDATE users
      SET password_hash = $1, last_password_change = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [hashedPassword, userId]);
    
    logger.info('Password changed successfully', { userId });
    
    return { success: true, message: 'Password changed successfully' };
  }
  
  /**
   * Récupère tous les comptes d'un utilisateur
   */
  async getUserAccounts(userId) {
    const result = await pool.query(`
      SELECT 
        id,
        account_number,
        account_type,
        currency,
        balance,
        available_balance,
        account_status,
        daily_transfer_limit,
        created_at,
        last_transaction_at
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
    // Nombre de comptes
    const accountsCount = await pool.query(
      'SELECT COUNT(*) as count FROM accounts WHERE user_id = $1',
      [userId]
    );
    
    // Nombre de transactions
    const transactionsCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions t
      INNER JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
      WHERE a.user_id = $1
    `, [userId]);
    
    // Solde total
    const totalBalance = await pool.query(
      'SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = $1',
      [userId]
    );
    
    // Dernière connexion
    const lastLogin = await pool.query(
      'SELECT last_login FROM users WHERE id = $1',
      [userId]
    );
    
    return {
      totalAccounts: parseInt(accountsCount.rows[0].count),
      totalTransactions: parseInt(transactionsCount.rows[0].count),
      totalBalance: parseInt(totalBalance.rows[0].total),
      lastLogin: lastLogin.rows[0]?.last_login
    };
  }
  
  /**
   * Vérifie si l'utilisateur peut effectuer une action
   */
  async canPerformAction(userId, action) {
    const user = await this.getUserById(userId);
    
    // Vérifier le statut du compte
    if (user.account_status === 'suspended') {
      return { allowed: false, reason: 'Account is suspended' };
    }
    
    if (user.account_status === 'locked') {
      return { allowed: false, reason: 'Account is locked' };
    }
    
    // Vérifier l'email
    if (!user.email_verified && action === 'transfer') {
      return { allowed: false, reason: 'Email must be verified' };
    }
    
    return { allowed: true };
  }
}

module.exports = new UserService();