/**
 * Account Controller - Gestion des comptes bancaires
 * FIXED VERSION - Handles account creation and admin access
 */

const AccountModel = require('../models/Account.model');
const TransactionModel = require('../models/Transaction.model');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class AccountController {
  /**
   * GET /api/accounts
   * Liste tous les comptes de l'utilisateur connecté
   */
  async listAccounts(req, res, next) {
    try {
      const userId = req.user.id;

      const accounts = await AccountModel.findByUserId(userId);

      await auditService.logAction({
        userId,
        action: 'LIST_ACCOUNTS',
        resourceType: 'account',
        eventType: 'data_access',
        severity: 'info',
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: {
          accounts: accounts.map(account => ({
            id: account.id,
            accountNumber: account.account_number,
            accountType: account.account_type,
            currency: account.currency,
            balance: account.balance / 100,
            availableBalance: account.available_balance / 100,
            accountStatus: account.account_status,
            dailyTransferLimit: account.daily_transfer_limit / 100,
            monthlyTransferLimit: account.monthly_transfer_limit / 100,
            createdAt: account.created_at,
            lastTransactionAt: account.last_transaction_at
          })),
          total: accounts.length
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'List Accounts',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/accounts/:id
   * Récupère les détails d'un compte spécifique
   * FIXED: Allow admin to access any account
   */
  async getAccountDetails(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);

      // Récupérer le compte
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin to access any account
      if (account.user_id !== userId && userRole !== 'admin') {
        await auditService.logSecurityEvent({
          userId,
          event: 'UNAUTHORIZED_ACCOUNT_ACCESS',
          severity: 'high',
          details: {
            attemptedAccountId: accountId,
            accountOwnerId: account.user_id
          },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Récupérer les statistiques du compte
      const stats = await AccountModel.getStats(accountId);

      res.status(200).json({
        success: true,
        data: {
          account: {
            id: account.id,
            accountNumber: account.account_number,
            accountType: account.account_type,
            currency: account.currency,
            balance: account.balance / 100,
            availableBalance: account.available_balance / 100,
            accountStatus: account.account_status,
            dailyTransferLimit: account.daily_transfer_limit / 100,
            monthlyTransferLimit: account.monthly_transfer_limit / 100,
            createdAt: account.created_at,
            lastTransactionAt: account.last_transaction_at
          },
          stats: {
            totalTransactions: parseInt(stats.total_transactions || 0),
            totalDebits: parseInt(stats.total_debits || 0) / 100,
            totalCredits: parseInt(stats.total_credits || 0) / 100,
            lastTransactionDate: stats.last_transaction_date
          }
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Account Details',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  /**
   * POST /api/accounts
   * Créer un nouveau compte bancaire
   * FIXED: Better error handling and validation
   */
  async createAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountType, currency, initialBalance } = req.body;

      // ✅ FIX: Validate account type
      const validTypes = ['checking', 'savings', 'business'];
      if (!accountType) {
        return res.status(400).json({
          success: false,
          error: 'Account type is required'
        });
      }

      if (!validTypes.includes(accountType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid account type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // ✅ FIX: Validate initial balance
      const balanceInCents = initialBalance ? Math.round(initialBalance * 100) : 0;
      
      if (balanceInCents < 0) {
        return res.status(400).json({
          success: false,
          error: 'Initial balance cannot be negative'
        });
      }

      // Créer le compte
      const account = await AccountModel.create({
        userId,
        accountType,
        currency: currency || 'USD',
        initialBalance: balanceInCents
      });

      // Log audit
      await auditService.logAction({
        userId,
        action: 'CREATE_ACCOUNT',
        resourceType: 'account',
        resourceId: account.id,
        eventType: 'account_change',
        severity: 'info',
        ipAddress: req.ip,
        newValues: {
          accountNumber: account.account_number,
          accountType,
          currency: currency || 'USD',
          initialBalance: balanceInCents / 100
        }
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          id: account.id,
          accountNumber: account.account_number,
          accountType: account.account_type,
          currency: account.currency,
          balance: account.balance / 100,
          availableBalance: account.available_balance / 100,
          accountStatus: account.account_status,
          createdAt: account.created_at
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Create Account',
        userId: req.user?.id,
        body: req.body
      });
      
      // ✅ FIX: Better error messages
      if (error.message.includes('duplicate') || error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Account number already exists. Please try again.'
        });
      }
      
      next(error);
    }
  }

  /**
   * GET /api/accounts/:id/balance
   * Récupère uniquement le solde d'un compte
   * FIXED: Allow admin access
   */
  async getBalance(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          accountId: account.id,
          accountNumber: account.account_number,
          balance: account.balance / 100,
          availableBalance: account.available_balance / 100,
          currency: account.currency,
          asOf: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Balance',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/accounts/:id/transactions
   * Liste les transactions d'un compte
   * FIXED: Allow admin access
   */
  async getAccountTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);

      // Vérifier que le compte appartient à l'utilisateur
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Options de pagination et filtrage
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        type: req.query.type,
        status: req.query.status
      };

      // Récupérer les transactions
      const result = await TransactionModel.findByAccountId(accountId, options);

      // Formater les transactions
      const transactions = result.transactions.map(tx => ({
        id: tx.id,
        transactionId: tx.transaction_id,
        type: tx.transaction_type,
        amount: tx.amount / 100,
        currency: tx.currency,
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

      res.status(200).json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: result.page,
            limit: options.limit,
            total: result.total,
            totalPages: result.totalPages
          }
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Account Transactions',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  // ... rest of the methods remain the same but add admin check
  
  async updateLimits(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);
      const { dailyLimit, monthlyLimit } = req.body;

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updated = await AccountModel.updateLimits(accountId, {
        dailyLimit: dailyLimit ? dailyLimit * 100 : null,
        monthlyLimit: monthlyLimit ? monthlyLimit * 100 : null
      });

      await auditService.logAction({
        userId,
        action: 'UPDATE_ACCOUNT_LIMITS',
        resourceType: 'account',
        resourceId: accountId,
        eventType: 'configuration_change',
        severity: 'info',
        ipAddress: req.ip,
        newValues: { dailyLimit, monthlyLimit }
      });

      res.status(200).json({
        success: true,
        message: 'Limits updated successfully',
        data: {
          accountId: updated.id,
          dailyTransferLimit: updated.daily_transfer_limit / 100,
          monthlyTransferLimit: updated.monthly_transfer_limit / 100
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update Limits',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);
      const { status } = req.body;

      const validStatuses = ['active', 'frozen'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updated = await AccountModel.updateStatus(accountId, status);

      await auditService.logSecurityEvent({
        userId,
        event: status === 'frozen' ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
        severity: status === 'frozen' ? 'warning' : 'info',
        details: {
          accountId,
          accountNumber: account.account_number,
          oldStatus: account.account_status,
          newStatus: status
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: `Account ${status === 'frozen' ? 'frozen' : 'activated'} successfully`,
        data: {
          accountId: updated.id,
          accountNumber: updated.account_number,
          accountStatus: updated.account_status
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update Account Status',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  async closeAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      if (account.balance !== 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot close account with non-zero balance',
          balance: account.balance / 100
        });
      }

      const closed = await AccountModel.close(accountId);

      await auditService.logSecurityEvent({
        userId,
        event: 'ACCOUNT_CLOSED',
        severity: 'warning',
        details: {
          accountId,
          accountNumber: account.account_number
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'Account closed successfully',
        data: {
          accountId: closed.id,
          accountNumber: closed.account_number,
          accountStatus: closed.account_status
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Close Account',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }

  async getStatement(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const accountId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // ✅ FIX: Allow admin access
      if (account.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const transactions = await TransactionModel.findByAccountId(accountId, {
        startDate,
        endDate,
        limit: 1000
      });

      const totals = transactions.transactions.reduce((acc, tx) => {
        if (tx.direction === 'debit') {
          acc.totalDebits += tx.amount;
          acc.debitCount++;
        } else {
          acc.totalCredits += tx.amount;
          acc.creditCount++;
        }
        return acc;
      }, {
        totalDebits: 0,
        totalCredits: 0,
        debitCount: 0,
        creditCount: 0
      });

      res.status(200).json({
        success: true,
        data: {
          account: {
            accountNumber: account.account_number,
            accountType: account.account_type,
            currency: account.currency
          },
          period: {
            startDate: startDate || transactions.transactions[0]?.created_at,
            endDate: endDate || new Date().toISOString()
          },
          openingBalance: account.balance / 100,
          closingBalance: account.balance / 100,
          transactions: transactions.transactions.map(tx => ({
            date: tx.created_at,
            description: tx.description || tx.transaction_type,
            reference: tx.transaction_id,
            debit: tx.direction === 'debit' ? tx.amount / 100 : null,
            credit: tx.direction === 'credit' ? tx.amount / 100 : null,
            balance: tx.from_balance_after ? tx.from_balance_after / 100 : null
          })),
          summary: {
            totalTransactions: transactions.transactions.length,
            totalDebits: totals.totalDebits / 100,
            totalCredits: totals.totalCredits / 100,
            debitCount: totals.debitCount,
            creditCount: totals.creditCount
          },
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Statement',
        userId: req.user?.id,
        accountId: req.params.id
      });
      next(error);
    }
  }
}

module.exports = new AccountController();