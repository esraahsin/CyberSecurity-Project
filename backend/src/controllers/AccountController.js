/**
 * Account Controller - Gestion des comptes bancaires
 * @module controllers/AccountController
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

      // Récupérer tous les comptes de l'utilisateur
      const accounts = await AccountModel.findByUserId(userId);

      // Log audit
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
            balance: account.balance / 100, // Convertir centimes en euros
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
   */
  async getAccountDetails(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);

      // Récupérer le compte
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // Vérifier que le compte appartient à l'utilisateur
      if (account.user_id !== userId) {
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
   * GET /api/accounts/:id/balance
   * Récupère uniquement le solde d'un compte
   */
  async getBalance(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);

      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      // Vérifier la propriété
      if (account.user_id !== userId) {
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
   */
  async getAccountTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);

      // Vérifier que le compte appartient à l'utilisateur
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      if (account.user_id !== userId) {
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
        direction: tx.direction, // 'debit' ou 'credit'
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

  /**
   * POST /api/accounts
   * Créer un nouveau compte bancaire
   */
  async createAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountType, currency, initialBalance } = req.body;

      // Valider le type de compte
      const validTypes = ['checking', 'savings', 'business'];
      if (!validTypes.includes(accountType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid account type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // Créer le compte
      const account = await AccountModel.create({
        userId,
        accountType,
        currency: currency || 'USD',
        initialBalance: initialBalance ? initialBalance * 100 : 0 // Convertir en centimes
      });

      // Log audit
      await auditService.logAction({
        userId,
        action: 'CREATE_ACCOUNT',
        resourceType: 'account',
        resourceId: account.id,
        eventType: 'data_access',
        severity: 'info',
        ipAddress: req.ip,
        newValues: {
          accountNumber: account.account_number,
          accountType,
          currency
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
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * PUT /api/accounts/:id/limits
   * Mettre à jour les limites de transfert
   */
  async updateLimits(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);
      const { dailyLimit, monthlyLimit } = req.body;

      // Vérifier la propriété du compte
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      if (account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Mettre à jour les limites (convertir en centimes)
      const updated = await AccountModel.updateLimits(accountId, {
        dailyLimit: dailyLimit ? dailyLimit * 100 : null,
        monthlyLimit: monthlyLimit ? monthlyLimit * 100 : null
      });

      // Log audit
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

  /**
   * PUT /api/accounts/:id/status
   * Changer le statut d'un compte (freeze/unfreeze)
   */
  async updateStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);
      const { status } = req.body;

      // Valider le statut
      const validStatuses = ['active', 'frozen'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Vérifier la propriété
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      if (account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Mettre à jour le statut
      const updated = await AccountModel.updateStatus(accountId, status);

      // Log audit
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

  /**
   * DELETE /api/accounts/:id
   * Fermer un compte (soft delete)
   */
  async closeAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);

      // Vérifier la propriété
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      if (account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Vérifier que le solde est zéro
      if (account.balance !== 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot close account with non-zero balance',
          balance: account.balance / 100
        });
      }

      // Fermer le compte
      const closed = await AccountModel.close(accountId);

      // Log audit
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

  /**
   * GET /api/accounts/:id/statement
   * Générer un relevé de compte
   */
  async getStatement(req, res, next) {
    try {
      const userId = req.user.id;
      const accountId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;

      // Vérifier la propriété
      const account = await AccountModel.findById(accountId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      if (account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Récupérer les transactions pour la période
      const transactions = await TransactionModel.findByAccountId(accountId, {
        startDate,
        endDate,
        limit: 1000 // Limite élevée pour le relevé
      });

      // Calculer les totaux
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
          openingBalance: account.balance / 100, // Simplification
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