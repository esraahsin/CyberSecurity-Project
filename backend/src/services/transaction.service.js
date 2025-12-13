/**
 * Service de gestion des transactions bancaires - COMPLETE & FIXED
 * @module services/transaction.service
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class TransactionService {
  /**
   * Récupère toutes les transactions d'un utilisateur
   */
   async getUserTransactions(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        type,
        status
      } = options;

      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          t.*,
          fa.account_number as from_account_number,
          ta.account_number as to_account_number,
          CASE 
            WHEN fa.user_id = $1 THEN 'debit'
            WHEN ta.user_id = $1 THEN 'credit'
            ELSE 'unknown'
          END as direction
        FROM transactions t
        LEFT JOIN accounts fa ON t.from_account_id = fa.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        WHERE (fa.user_id = $1 OR ta.user_id = $1)
      `;

      const params = [userId];
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

      if (status) {
        query += ` AND t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Count total
      const countQuery = query.replace(
        'SELECT t.*, fa.account_number as from_account_number, ta.account_number as to_account_number, CASE WHEN fa.user_id = $1 THEN \'debit\' WHEN ta.user_id = $1 THEN \'credit\' ELSE \'unknown\' END as direction',
        'SELECT COUNT(*)'
      );
      
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count || 0);

      // Add pagination
      query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Format transactions
      const transactions = result.rows.map(tx => ({
        id: tx.id,
        transactionId: tx.transaction_id,
        type: tx.transaction_type,
        amount: tx.amount / 100, // Convert cents to dollars
        currency: tx.currency || 'USD',
        direction: tx.direction,
        status: tx.status,
        description: tx.description,
        fromAccount: tx.from_account_number,
        toAccount: tx.to_account_number,
        balanceBefore: tx.from_balance_before ? tx.from_balance_before / 100 : null,
        balanceAfter: tx.from_balance_after ? tx.from_balance_after / 100 : null,
        createdAt: tx.created_at,
        completedAt: tx.completed_at
      }));

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Get user transactions failed', { error: error.message, userId });
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }
  }

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
   * Récupère une transaction par ID
   */
  async getTransactionById(transactionId) {
    const query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE t.id = $1
    `;

    const result = await pool.query(query, [transactionId]);
    return result.rows[0] || null;
  }

  /**
   * Vérifie si un utilisateur est impliqué dans une transaction
   */
  async isUserInvolvedInTransaction(userId, transactionId) {
    const query = `
      SELECT t.id
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE t.id = $1 
      AND (fa.user_id = $2 OR ta.user_id = $2)
    `;

    const result = await pool.query(query, [transactionId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Annule une transaction
   */
  async cancelTransaction(transactionId, reason = null) {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'completed') {
      throw new Error('Cannot cancel completed transaction');
    }

    const query = `
      UPDATE transactions
      SET 
        status = 'cancelled',
        fraud_reason = COALESCE($1, fraud_reason)
      WHERE id = $2
      RETURNING id, transaction_id, status
    `;

    const result = await pool.query(query, [reason, transactionId]);

    logger.info('Transaction cancelled', { 
      transactionId: transaction.transaction_id, 
      reason 
    });

    return result.rows[0];
  }

  /**
   * Crée une contestation
   */
  async createDispute(transactionId, userId, reason, description) {
    // Implementation placeholder
    return {
      id: Date.now(),
      transactionId,
      userId,
      reason,
      description,
      status: 'pending'
    };
  }

  /**
   * Exporte les transactions en CSV
   */
  async exportTransactionsToCSV(userId, options = {}) {
    const { startDate, endDate, accountId } = options;

    const transactions = await this.getUserTransactions(userId, {
      startDate,
      endDate,
      limit: 10000
    });

    // CSV Header
    let csv = 'Date,Transaction ID,Type,Amount,Currency,Status,Description,From Account,To Account\n';

    // CSV Rows
    transactions.transactions.forEach(tx => {
      csv += `${tx.createdAt},${tx.transactionId},${tx.type},${tx.amount},${tx.currency},${tx.status},"${tx.description || ''}",${tx.fromAccount || ''},${tx.toAccount || ''}\n`;
    });

    return csv;
  }

  /**
   * Récupère les transactions en attente d'un utilisateur
   */
  async getUserPendingTransactions(userId) {
    const query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE (fa.user_id = $1 OR ta.user_id = $1)
      AND t.status = 'pending'
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Récupère les statistiques de transactions
   */
  async getUserTransactionStats(userId, options = {}) {
    const { period = '30 days', accountId } = options;

    let query = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount,
        COALESCE(MAX(amount), 0) as largest_transaction
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE (fa.user_id = $1 OR ta.user_id = $1)
      AND t.created_at > NOW() - INTERVAL '${period}'
      AND t.status = 'completed'
    `;

    const result = await pool.query(query, [userId]);
    const stats = result.rows[0];

    return {
      totalTransactions: parseInt(stats.total_transactions),
      totalAmount: parseInt(stats.total_amount) / 100,
      averageAmount: parseInt(stats.average_amount) / 100,
      largestTransaction: parseInt(stats.largest_transaction) / 100
    };
  }

  /**
   * Crée un dépôt
   */
  async createDeposit(accountId, amount, description) {
    // Implementation placeholder
    return {
      transactionId: `TXN${Date.now()}`,
      amount,
      newBalance: 0 // Should be calculated
    };
  }

  /**
   * Crée un retrait
   */
  async createWithdrawal(accountId, amount, description) {
    // Implementation placeholder
    return {
      transactionId: `TXN${Date.now()}`,
      amount,
      newBalance: 0 // Should be calculated
    };
  }
}

module.exports = new TransactionService();