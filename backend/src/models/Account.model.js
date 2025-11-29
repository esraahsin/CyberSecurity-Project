/**
 * Model Account - Gestion des comptes bancaires
 * @module models/Account.model
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

class AccountModel {
  /**
   * CREATE - Crée un nouveau compte bancaire
   */
  async create(accountData) {
    const {
      userId,
      accountType = 'checking',
      currency = 'USD',
      initialBalance = 0
    } = accountData;

    const query = `
      INSERT INTO accounts (
        user_id, account_number, account_type,
        currency, balance, available_balance
      )
      VALUES ($1, generate_account_number(), $2, $3, $4, $5)
      RETURNING 
        id, user_id, account_number, account_type,
        currency, balance, available_balance, account_status,
        daily_transfer_limit, monthly_transfer_limit, created_at
    `;

    const values = [
      userId,
      accountType,
      currency,
      initialBalance,
      initialBalance
    ];

    try {
      const result = await pool.query(query, values);
      logger.info('Account created', { 
        accountId: result.rows[0].id, 
        userId,
        accountNumber: result.rows[0].account_number 
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Account creation failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * READ - Trouve un compte par ID
   */
  async findById(id) {
    const query = `
      SELECT 
        a.*,
        u.email, u.first_name, u.last_name
      FROM accounts a
      INNER JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve un compte par numéro
   */
  async findByAccountNumber(accountNumber) {
    const query = `
      SELECT 
        id, user_id, account_number, account_type,
        currency, balance, available_balance,
        account_status, daily_transfer_limit,
        monthly_transfer_limit, created_at, updated_at
      FROM accounts
      WHERE account_number = $1
    `;

    const result = await pool.query(query, [accountNumber]);
    return result.rows[0] || null;
  }

  /**
   * READ - Trouve tous les comptes d'un utilisateur
   */
  async findByUserId(userId) {
    const query = `
      SELECT 
        id, account_number, account_type, currency,
        balance, available_balance, account_status,
        daily_transfer_limit, monthly_transfer_limit,
        created_at, last_transaction_at
      FROM accounts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * READ - Liste tous les comptes (avec pagination)
   */
  async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      accountType,
      minBalance 
    } = options;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.id, a.account_number, a.account_type,
        a.currency, a.balance, a.account_status,
        a.created_at,
        u.email, u.first_name, u.last_name
      FROM accounts a
      INNER JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND a.account_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (accountType) {
      query += ` AND a.account_type = $${paramIndex}`;
      params.push(accountType);
      paramIndex++;
    }

    if (minBalance !== undefined) {
      query += ` AND a.balance >= $${paramIndex}`;
      params.push(minBalance);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Compter le total
    const countQuery = 'SELECT COUNT(*) as total FROM accounts';
    const countResult = await pool.query(countQuery);

    return {
      accounts: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    };
  }

  /**
   * UPDATE - Met à jour le solde
   */
  async updateBalance(id, amount, operation = 'add') {
    const operator = operation === 'add' ? '+' : '-';
    
    const query = `
      UPDATE accounts
      SET 
        balance = balance ${operator} $1,
        available_balance = available_balance ${operator} $1,
        updated_at = NOW(),
        last_transaction_at = NOW()
      WHERE id = $2
      RETURNING 
        id, account_number, balance, available_balance
    `;

    const result = await pool.query(query, [amount, id]);

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    logger.info('Balance updated', { 
      accountId: id, 
      operation, 
      amount,
      newBalance: result.rows[0].balance 
    });

    return result.rows[0];
  }

  /**
   * UPDATE - Met à jour les limites de transfert
   */
  async updateLimits(id, limits) {
    const { dailyLimit, monthlyLimit } = limits;

    const query = `
      UPDATE accounts
      SET 
        daily_transfer_limit = COALESCE($1, daily_transfer_limit),
        monthly_transfer_limit = COALESCE($2, monthly_transfer_limit),
        updated_at = NOW()
      WHERE id = $3
      RETURNING 
        id, daily_transfer_limit, monthly_transfer_limit
    `;

    const result = await pool.query(query, [dailyLimit, monthlyLimit, id]);

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    logger.info('Account limits updated', { accountId: id, limits });
    return result.rows[0];
  }

  /**
   * UPDATE - Change le statut du compte
   */
  async updateStatus(id, status) {
    const validStatuses = ['active', 'frozen', 'closed'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const query = `
      UPDATE accounts
      SET 
        account_status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, account_number, account_status
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    logger.info('Account status updated', { accountId: id, status });
    return result.rows[0];
  }

  /**
   * UPDATE - Gèle un compte
   */
  async freeze(id, reason = null) {
    const query = `
      UPDATE accounts
      SET 
        account_status = 'frozen',
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, account_number, account_status
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    logger.warn('Account frozen', { accountId: id, reason });
    return result.rows[0];
  }

  /**
   * DELETE - Ferme un compte (soft delete)
   */
  async close(id) {
    const account = await this.findById(id);

    if (!account) {
      throw new Error('Account not found');
    }

    // Vérifier que le solde est 0
    if (account.balance !== 0) {
      throw new Error('Cannot close account with non-zero balance');
    }

    const query = `
      UPDATE accounts
      SET 
        account_status = 'closed',
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, account_number, account_status
    `;

    const result = await pool.query(query, [id]);

    logger.info('Account closed', { accountId: id });
    return result.rows[0];
  }

  /**
   * DELETE - Supprime définitivement un compte
   */
  async hardDelete(id) {
    const query = 'DELETE FROM accounts WHERE id = $1 RETURNING id, account_number';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    logger.warn('Account permanently deleted', { accountId: id });
    return result.rows[0];
  }

  /**
   * Vérifie si un compte peut effectuer une transaction
   */
  async canTransact(id, amount) {
    const account = await this.findById(id);

    if (!account) {
      return { can: false, reason: 'Account not found' };
    }

    if (account.account_status !== 'active') {
      return { can: false, reason: `Account is ${account.account_status}` };
    }

    if (account.available_balance < amount) {
      return { can: false, reason: 'Insufficient funds' };
    }

    return { can: true };
  }

  /**
   * Récupère les statistiques d'un compte
   */
  async getStats(id) {
    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN t.from_account_id = $1 THEN t.amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN t.to_account_id = $1 THEN t.amount ELSE 0 END), 0) as total_credits,
        MAX(t.created_at) as last_transaction_date
      FROM transactions t
      WHERE (t.from_account_id = $1 OR t.to_account_id = $1)
      AND t.status = 'completed'
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = new AccountModel();