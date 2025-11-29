/**
 * Model Transaction - Gestion des transactions bancaires
 * @module models/Transaction.model
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class TransactionModel {
  /**
   * CREATE - Crée une nouvelle transaction
   */
  async create(transactionData) {
    const {
      fromAccountId,
      toAccountId,
      transactionType,
      amount,
      currency = 'USD',
      description = '',
      referenceNumber = null,
      ipAddress = null,
      userAgent = null
    } = transactionData;

    // Générer un ID de transaction unique
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;

    const query = `
      INSERT INTO transactions (
        transaction_id, from_account_id, to_account_id,
        transaction_type, amount, currency,
        description, reference_number,
        ip_address, user_agent, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      transactionId,
      fromAccountId || null,
      toAccountId || null,
      transactionType,
      amount,
      currency,
      description,
      referenceNumber,
      ipAddress,
      userAgent,
      'pending'
    ];

    try {
      const result = await pool.query(query, values);
      logger.info('Transaction created', { 
        transactionId, 
        type: transactionType, 
        amount 
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Transaction creation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * READ - Trouve une transaction par ID
   */
  async findById(id) {
    const query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number,
        fu.first_name || ' ' || fu.last_name as from_user_name,
        tu.first_name || ' ' || tu.last_name as to_user_name
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN users fu ON fa.user_id = fu.id
      LEFT JOIN users tu ON ta.user_id = tu.id
      WHERE t.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve une transaction par transaction_id
   */
  async findByTransactionId(transactionId) {
    const query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE t.transaction_id = $1
    `;

    const result = await pool.query(query, [transactionId]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve toutes les transactions d'un compte
   */
  async findByAccountId(accountId, options = {}) {
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
        CASE 
          WHEN t.from_account_id = $1 THEN 'debit'
          WHEN t.to_account_id = $1 THEN 'credit'
        END as direction,
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

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions
      WHERE (from_account_id = $1 OR to_account_id = $1)
    `;
    const countResult = await pool.query(countQuery, [accountId]);

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    };
  }

  /**
   * READ - Transactions en attente
   */
  async findPending(options = {}) {
    const { limit = 50 } = options;

    const query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * UPDATE - Met à jour le statut d'une transaction
   */
  async updateStatus(id, status, additionalData = {}) {
    const validStatuses = [
      'pending', 'processing', 'completed', 
      'failed', 'cancelled', 'reversed'
    ];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const fields = ['status = $1'];
    const values = [status, id];
    let paramIndex = 3;

    // Ajouter les timestamps appropriés
    if (status === 'processing') {
      fields.push('processed_at = NOW()');
    }

    if (status === 'completed') {
      fields.push('completed_at = NOW()');
    }

    // Ajouter les données supplémentaires
    if (additionalData.fraudScore !== undefined) {
      fields.push(`fraud_score = $${paramIndex}`);
      values.push(additionalData.fraudScore);
      paramIndex++;
    }

    if (additionalData.fraudReason) {
      fields.push(`fraud_reason = $${paramIndex}`);
      values.push(additionalData.fraudReason);
      paramIndex++;
    }

    const query = `
      UPDATE transactions
      SET ${fields.join(', ')}
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    logger.info('Transaction status updated', { 
      transactionId: result.rows[0].transaction_id, 
      status 
    });

    return result.rows[0];
  }

  /**
   * UPDATE - Met à jour le score de fraude
   */
  async updateFraudScore(id, fraudScore, fraudChecked = true, fraudReason = null) {
    const query = `
      UPDATE transactions
      SET 
        fraud_score = $1,
        fraud_checked = $2,
        fraud_reason = $3
      WHERE id = $4
      RETURNING id, transaction_id, fraud_score, fraud_checked
    `;

    const result = await pool.query(query, [fraudScore, fraudChecked, fraudReason, id]);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return result.rows[0];
  }

  /**
   * UPDATE - Ajoute les balances avant/après
   */
  async updateBalances(id, balances) {
    const {
      fromBalanceBefore,
      fromBalanceAfter,
      toBalanceBefore,
      toBalanceAfter
    } = balances;

    const query = `
      UPDATE transactions
      SET 
        from_balance_before = $1,
        from_balance_after = $2,
        to_balance_before = $3,
        to_balance_after = $4
      WHERE id = $5
      RETURNING id, transaction_id
    `;

    const values = [
      fromBalanceBefore,
      fromBalanceAfter,
      toBalanceBefore,
      toBalanceAfter,
      id
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return result.rows[0];
  }

  /**
   * DELETE - Annule une transaction (soft delete)
   */
  async cancel(id, reason = null) {
    const transaction = await this.findById(id);

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

    const result = await pool.query(query, [reason, id]);

    logger.info('Transaction cancelled', { 
      transactionId: transaction.transaction_id, 
      reason 
    });

    return result.rows[0];
  }

  /**
   * DELETE - Supprime définitivement une transaction
   */
  async hardDelete(id) {
    const query = 'DELETE FROM transactions WHERE id = $1 RETURNING id, transaction_id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    logger.warn('Transaction permanently deleted', { 
      transactionId: result.rows[0].transaction_id 
    });

    return result.rows[0];
  }

  /**
   * Récupère les statistiques d'un compte
   */
  async getAccountStats(accountId, period = '30 days') {
    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE from_account_id = $1) as debits_count,
        COUNT(*) FILTER (WHERE to_account_id = $1) as credits_count,
        COALESCE(SUM(amount) FILTER (WHERE from_account_id = $1 AND status = 'completed'), 0) as total_debits,
        COALESCE(SUM(amount) FILTER (WHERE to_account_id = $1 AND status = 'completed'), 0) as total_credits,
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE (from_account_id = $1 OR to_account_id = $1)
      AND created_at > NOW() - INTERVAL '${period}'
    `;

    const result = await pool.query(query, [accountId]);
    return result.rows[0];
  }

  /**
   * Recherche de transactions
   */
  async search(searchParams) {
    const {
      transactionId,
      accountNumber,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      status,
      type
    } = searchParams;

    let query = `
      SELECT 
        t.*,
        fa.account_number as from_account_number,
        ta.account_number as to_account_number
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (transactionId) {
      query += ` AND t.transaction_id ILIKE $${paramIndex}`;
      params.push(`%${transactionId}%`);
      paramIndex++;
    }

    if (accountNumber) {
      query += ` AND (fa.account_number = $${paramIndex} OR ta.account_number = $${paramIndex})`;
      params.push(accountNumber);
      paramIndex++;
    }

    if (minAmount) {
      query += ` AND t.amount >= $${paramIndex}`;
      params.push(minAmount);
      paramIndex++;
    }

    if (maxAmount) {
      query += ` AND t.amount <= $${paramIndex}`;
      params.push(maxAmount);
      paramIndex++;
    }

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

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ' ORDER BY t.created_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = new TransactionModel();