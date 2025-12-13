/**
 * Transaction Controller - COMPLETE & FIXED
 * @module controllers/TransactionController
 */

const transactionService = require('../services/transaction.service');
const fraudDetectionService = require('../services/fraud-detection.service');
const AccountModel = require('../models/Account.model');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class TransactionController {
  /**
   * POST /api/transactions/transfer
   * Effectue un transfert entre comptes
   */
  async createTransfer(req, res, next) {
    try {
      const userId = req.user.id;
      const { fromAccountId, toAccountNumber, amount, description, currency = 'USD' } = req.body;

      // Valider le montant
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
          message: 'Amount must be greater than 0'
        });
      }

      // Convertir le montant en centimes
      const amountInCents = Math.round(amount * 100);

      // Vérifier que le compte source appartient à l'utilisateur
      const fromAccount = await AccountModel.findById(fromAccountId);
      
      if (!fromAccount) {
        return res.status(404).json({
          success: false,
          error: 'Source account not found'
        });
      }

      if (fromAccount.user_id !== userId) {
        await auditService.logSecurityEvent({
          userId,
          event: 'UNAUTHORIZED_TRANSFER_ATTEMPT',
          severity: 'high',
          details: {
            fromAccountId,
            actualOwnerId: fromAccount.user_id
          },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not own this account'
        });
      }

      // Trouver le compte destinataire
      const toAccount = await AccountModel.findByAccountNumber(toAccountNumber);
      
      if (!toAccount) {
        return res.status(404).json({
          success: false,
          error: 'Destination account not found'
        });
      }

      // Valider la transaction
      const validation = await transactionService.validateTransaction(
        fromAccountId,
        toAccount.id,
        amountInCents
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Transaction validation failed',
          errors: validation.errors
        });
      }

      // Vérifier la détection de fraude
      const fraudCheck = await fraudDetectionService.calculateRiskScore({
        fromAccountId,
        toAccountId: toAccount.id,
        amount: amountInCents,
        ipAddress: req.ip
      });

      // Log le score de fraude
      logger.info('Fraud check completed', {
        transactionAmount: amount,
        riskScore: fraudCheck.riskScore,
        riskLevel: fraudCheck.riskLevel
      });

      // Bloquer si score de fraude trop élevé
      if (fraudCheck.shouldBlock) {
        await auditService.logSecurityEvent({
          userId,
          event: 'TRANSACTION_BLOCKED_FRAUD',
          severity: 'critical',
          details: {
            fromAccountId,
            toAccountId: toAccount.id,
            amount,
            riskScore: fraudCheck.riskScore,
            riskFactors: fraudCheck.riskFactors
          },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'Transaction blocked',
          message: 'This transaction has been flagged for security review',
          riskScore: fraudCheck.riskScore,
          riskFactors: fraudCheck.riskFactors
        });
      }

      // Effectuer le transfert
      const result = await transactionService.createTransfer(
        fromAccountId,
        toAccount.id,
        amountInCents,
        userId,
        description || `Transfer to ${toAccountNumber}`
      );

      // Log audit
      await auditService.logTransaction({
        userId,
        transactionId: result.transactionId,
        fromAccount: fromAccount.account_number,
        toAccount: toAccountNumber,
        amount: amountInCents,
        type: 'transfer',
        status: result.status,
        ipAddress: req.ip,
        metadata: {
          riskScore: fraudCheck.riskScore,
          riskLevel: fraudCheck.riskLevel
        }
      });

      res.status(201).json({
        success: true,
        message: 'Transfer completed successfully',
        data: {
          transactionId: result.transactionId,
          fromAccount: fromAccount.account_number,
          toAccount: toAccountNumber,
          amount: result.amount / 100,
          currency,
          status: result.status,
          riskLevel: fraudCheck.riskLevel
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Create Transfer',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/transactions/deposit
   * Effectue un dépôt sur un compte
   */
  async createDeposit(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId, amount, description } = req.body;

      // Vérifier la propriété du compte
      const account = await AccountModel.findById(accountId);
      
      if (!account || account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const amountInCents = Math.round(amount * 100);

      // Créer la transaction de dépôt
      const transaction = await transactionService.createDeposit(
        accountId,
        amountInCents,
        description || 'Deposit'
      );

      res.status(201).json({
        success: true,
        message: 'Deposit successful',
        data: {
          transactionId: transaction.transactionId,
          accountNumber: account.account_number,
          amount: transaction.amount / 100,
          newBalance: transaction.newBalance / 100
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Create Deposit',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/transactions/withdraw
   * Effectue un retrait d'un compte
   */
  async createWithdrawal(req, res, next) {
    try {
      const userId = req.user.id;
      const { accountId, amount, description } = req.body;

      // Vérifier la propriété du compte
      const account = await AccountModel.findById(accountId);
      
      if (!account || account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const amountInCents = Math.round(amount * 100);

      // Vérifier le solde
      if (account.available_balance < amountInCents) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient funds'
        });
      }

      // Créer la transaction de retrait
      const transaction = await transactionService.createWithdrawal(
        accountId,
        amountInCents,
        description || 'Withdrawal'
      );

      res.status(201).json({
        success: true,
        message: 'Withdrawal successful',
        data: {
          transactionId: transaction.transactionId,
          accountNumber: account.account_number,
          amount: transaction.amount / 100,
          newBalance: transaction.newBalance / 100
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Create Withdrawal',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/transactions
   * Liste toutes les transactions de l'utilisateur
   */
  async listUserTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, startDate, endDate, type, status } = req.query;

      console.log('📊 Fetching transactions for user:', userId, {
        page,
        limit,
        type,
        status,
        startDate,
        endDate
      });

      const result = await transactionService.getUserTransactions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate,
        type,
        status
      });

      console.log('✅ Transactions fetched:', {
        count: result.transactions?.length || 0,
        total: result.pagination?.total || 0
      });

      // ✅ Always return valid response even with no data
      res.status(200).json({
        success: true,
        data: {
          transactions: result.transactions || [],
          pagination: result.pagination || {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }
      });
    } catch (error) {
      console.error('❌ List User Transactions Error:', error);
      logger.logError(error, { 
        context: 'List User Transactions',
        userId: req.user?.id,
        query: req.query
      });
      
      // ✅ Return proper error response instead of crashing
      res.status(500).json({
        success: false,
        error: 'Failed to load transactions',
        message: error.message,
        data: {
          transactions: [],
          pagination: {
            page: parseInt(req.query.page || 1),
            limit: parseInt(req.query.limit || 20),
            total: 0,
            totalPages: 0
          }
        }
      });
    }
  }

  /**
   * GET /api/transactions/:id
   * Récupère les détails d'une transaction
   */
  async getTransactionById(req, res, next) {
    try {
      const userId = req.user.id;
      const transactionId = parseInt(req.params.id);

      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      // Vérifier que l'utilisateur est impliqué dans cette transaction
      const isOwner = await transactionService.isUserInvolvedInTransaction(
        userId,
        transactionId
      );

      if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.status(200).json({
        success: true,
        data: { transaction }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Transaction By ID',
        userId: req.user?.id,
        transactionId: req.params.id
      });
      next(error);
    }
  }

  /**
   * POST /api/transactions/:id/cancel
   * Annule une transaction en attente
   */
  async cancelTransaction(req, res, next) {
    try {
      const userId = req.user.id;
      const transactionId = parseInt(req.params.id);
      const { reason } = req.body;

      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      // Vérifier la propriété
      const isOwner = await transactionService.isUserInvolvedInTransaction(
        userId,
        transactionId
      );

      if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Vérifier que la transaction peut être annulée
      if (transaction.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel this transaction',
          message: `Transaction is ${transaction.status}`
        });
      }

      // Annuler la transaction
      await transactionService.cancelTransaction(transactionId, reason);

      // Log audit
      await auditService.logAction({
        userId,
        action: 'CANCEL_TRANSACTION',
        resourceType: 'transaction',
        resourceId: transactionId,
        eventType: 'transaction',
        severity: 'warning',
        ipAddress: req.ip,
        metadata: { reason }
      });

      res.status(200).json({
        success: true,
        message: 'Transaction cancelled successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Cancel Transaction',
        userId: req.user?.id,
        transactionId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/transactions/stats
   * Récupère les statistiques de transactions
   */
  async getTransactionStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { period = '30 days', accountId } = req.query;

      const stats = await transactionService.getUserTransactionStats(userId, {
        period,
        accountId: accountId ? parseInt(accountId) : null
      });

      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Transaction Stats',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/transactions/pending
   * Liste les transactions en attente
   */
  async getPendingTransactions(req, res, next) {
    try {
      const userId = req.user.id;

      const transactions = await transactionService.getUserPendingTransactions(userId);

      res.status(200).json({
        success: true,
        data: {
          transactions,
          total: transactions.length
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Pending Transactions',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/transactions/:id/dispute
   * Conteste une transaction
   */
  async disputeTransaction(req, res, next) {
    try {
      const userId = req.user.id;
      const transactionId = parseInt(req.params.id);
      const { reason, description } = req.body;

      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      // Vérifier la propriété
      const isOwner = await transactionService.isUserInvolvedInTransaction(
        userId,
        transactionId
      );

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Créer la contestation
      const dispute = await transactionService.createDispute(
        transactionId,
        userId,
        reason,
        description
      );

      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'TRANSACTION_DISPUTED',
        severity: 'high',
        details: {
          transactionId,
          reason,
          disputeId: dispute.id
        },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Dispute created successfully',
        data: { dispute }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Dispute Transaction',
        userId: req.user?.id,
        transactionId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/transactions/export
   * Exporte les transactions au format CSV
   */
  async exportTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate, accountId } = req.query;

      const csv = await transactionService.exportTransactionsToCSV(userId, {
        startDate,
        endDate,
        accountId: accountId ? parseInt(accountId) : null
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.status(200).send(csv);
    } catch (error) {
      logger.logError(error, { 
        context: 'Export Transactions',
        userId: req.user?.id 
      });
      next(error);
    }
  }
}

module.exports = new TransactionController();