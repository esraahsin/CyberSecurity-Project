/**
 * Service de gestion des transactions bancaires
 * @module services/transaction.service
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class TransactionService {
  /**
   * Crée un transfert entre deux comptes
   */
  async createTransfer(fromAccountId, toAccountId, amount, userId, description = '') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Vérifier le solde disponible
      const fromAccount = await client.query(
        'SELECT balance, account_status, daily_transfer_limit FROM accounts WHERE id = $1',
        [fromAccountId]
      );
      
      if (!fromAccount.rows[0]) {
        throw new Error('Source account not found');
      }
      
      if (fromAccount.rows[0].account_status !== 'active') {
        throw new Error('Source account is not active');
      }
      
      if (fromAccount.rows[0].balance < amount) {
        throw new Error('Insufficient funds');
      }
      
      // 2. Vérifier les limites quotidiennes
      await this.checkDailyLimits(fromAccountId, amount, client);
      
      // 3. Vérifier le compte destinataire
      const toAccount = await client.query(
        'SELECT account_status FROM accounts WHERE id = $1',
        [toAccountId]
      );
      
      if (!toAccount.rows[0]) {
        throw new Error('Destination account not found');
      }
      
      if (toAccount.rows[0].account_status !== 'active') {
        throw new Error('Destination account is not active');
      }
      
      // 4. Créer la transaction
      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
      
      const transaction = await client.query(`
        INSERT INTO transactions (
          transaction_id, from_account_id, to_account_id,
          transaction_type, amount, status, description,
          from_balance_before, from_balance_after,
          to_balance_before, to_balance_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        transactionId,
        fromAccountId,
        toAccountId,
        'transfer',
        amount,
        'processing',
        description,
        fromAccount.rows[0].balance,
        fromAccount.rows[0].balance - amount,
        toAccount.rows[0].balance || 0,
        (toAccount.rows[0].balance || 0) + amount
      ]);
      
      // 5. Mettre à jour les soldes
      await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
        [amount, fromAccountId]
      );
      
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [amount, toAccountId]
      );
      
      // 6. Marquer comme complétée
      await client.query(
        'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', transaction.rows[0].id]
      );
      
      await client.query('COMMIT');
      
      logger.info('Transfer completed', {
        transactionId,
        fromAccountId,
        toAccountId,
        amount,
        userId
      });
      
      return {
        success: true,
        transactionId,
        amount,
        status: 'completed'
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transfer failed', { error: error.message, userId });
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Valide une transaction avant exécution
   */
  async validateTransaction(fromAccountId, toAccountId, amount) {
    const errors = [];
    
    // Validation du montant
    if (!amount || amount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (amount > 1000000) { // 10,000.00
      errors.push('Amount exceeds maximum transfer limit');
    }
    
    // Validation des comptes
    if (fromAccountId === toAccountId) {
      errors.push('Cannot transfer to the same account');
    }
    
    // Vérifier l'existence des comptes
    const accounts = await pool.query(
      'SELECT id, account_status FROM accounts WHERE id IN ($1, $2)',
      [fromAccountId, toAccountId]
    );
    
    if (accounts.rows.length !== 2) {
      errors.push('One or both accounts do not exist');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Vérifie les limites quotidiennes
   */
  async checkDailyLimits(accountId, amount, client = pool) {
    const today = new Date().toISOString().split('T')[0];
    
    // Récupérer les limites du compte
    const account = await client.query(
      'SELECT daily_transfer_limit FROM accounts WHERE id = $1',
      [accountId]
    );
    
    const dailyLimit = account.rows[0]?.daily_transfer_limit || 500000; // 5000.00
    
    // Calculer le total transféré aujourd'hui
    const todayTransfers = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE from_account_id = $1
      AND DATE(created_at) = $2
      AND status = 'completed'
    `, [accountId, today]);
    
    const totalToday = parseInt(todayTransfers.rows[0].total);
    
    if (totalToday + amount > dailyLimit) {
      throw new Error('Daily transfer limit exceeded');
    }
    
    return {
      dailyLimit,
      usedToday: totalToday,
      remaining: dailyLimit - totalToday,
      canTransfer: (dailyLimit - totalToday) >= amount
    };
  }
  
  /**
   * Récupère l'historique des transactions
   */
  async getTransactionHistory(accountId, options = {}) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      type
    } = options;
    
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE (t.from_account_id = $1 OR t.to_account_id = $1)
    `;
    
    const params = [accountId];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      WHERE (t.from_account_id = $1 OR t.to_account_id = $1)
    `;
    const countResult = await pool.query(countQuery, [accountId]);
    
    return {
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    };
  }
}

module.exports = new TransactionService();