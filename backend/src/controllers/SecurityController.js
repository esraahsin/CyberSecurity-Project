/**
 * Security Controller - Gestion de la sécurité
 * @module controllers/SecurityController
 */

const fraudDetectionService = require('../services/fraud-detection.service');
const auditService = require('../services/audit.service');
const sessionService = require('../services/session.service');
const logger = require('../utils/logger');

class SecurityController {
  /**
   * GET /api/security/sessions
   * Récupère les sessions actives de l'utilisateur
   */
  async getUserSessions(req, res, next) {
    try {
      const userId = req.user.id;

      const sessions = await sessionService.getUserSessions(userId);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          total: sessions.length
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get User Sessions',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * DELETE /api/security/sessions/:sessionId
   * Termine une session spécifique
   */
  async terminateSession(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      // Vérifier que la session appartient à l'utilisateur
      const session = await sessionService.validateSession(sessionId);
      
      if (session.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      await sessionService.endSession(sessionId);

      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'SESSION_TERMINATED',
        severity: 'info',
        details: { sessionId },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'Session terminated successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Terminate Session',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/security/activity
   * Récupère l'activité récente de l'utilisateur
   */
  async getUserActivity(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;

      const logs = await auditService.getAuditLogs(
        { userId },
        { page: 1, limit: parseInt(limit) }
      );

      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get User Activity',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/security/alerts
   * Récupère les alertes de sécurité de l'utilisateur
   */
  async getSecurityAlerts(req, res, next) {
    try {
      const userId = req.user.id;

      const alerts = await auditService.getAuditLogs(
        { 
          userId, 
          eventType: 'security_event',
          severity: ['warning', 'error', 'critical']
        },
        { page: 1, limit: 10 }
      );

      res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Security Alerts',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/security/check-fraud
   * Vérifie le score de fraude d'une transaction potentielle
   */
  async checkFraudScore(req, res, next) {
    try {
      const userId = req.user.id;
      const { fromAccountId, toAccountId, amount } = req.body;

      // Vérifier que le compte appartient à l'utilisateur
      const AccountModel = require('../models/Account.model');
      const account = await AccountModel.findById(fromAccountId);

      if (!account || account.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Calculer le score de fraude
      const fraudCheck = await fraudDetectionService.calculateRiskScore({
        fromAccountId,
        toAccountId,
        amount: amount * 100, // Convertir en centimes
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: fraudCheck
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Check Fraud Score',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/security/report-suspicious
   * Signale une activité suspecte
   */
  async reportSuspicious(req, res, next) {
    try {
      const userId = req.user.id;
      const { type, description, relatedId } = req.body;

      // Log comme événement de sécurité
      await auditService.logSecurityEvent({
        userId,
        event: 'SUSPICIOUS_ACTIVITY_REPORTED',
        severity: 'high',
        details: {
          type,
          description,
          relatedId,
          reportedBy: userId
        },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Report Suspicious',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * PUT /api/security/password-strength
   * Vérifie la force d'un mot de passe
   */
  async checkPasswordStrength(req, res, next) {
    try {
      const { password } = req.body;

      const { validatePassword } = require('../utils/validators');
      const result = validatePassword(password);

      res.status(200).json({
        success: true,
        data: {
          strong: result.valid,
          errors: result.errors
        }
      });
    } catch (error) {
      logger.logError(error, { context: 'Check Password Strength' });
      next(error);
    }
  }

  /**
   * GET /api/security/login-history
   * Historique des connexions
   */
  async getLoginHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const history = await auditService.getAuditLogs(
        { 
          userId,
          action: ['LOGIN_SUCCESS', 'LOGIN_FAILED']
        },
        { page: 1, limit: parseInt(limit) }
      );

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Login History',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/security/enable-2fa
   * Active l'authentification à deux facteurs
   */
  async enable2FA(req, res, next) {
    try {
      const userId = req.user.id;

      // TODO: Implémenter la génération du secret TOTP
      // const secret = speakeasy.generateSecret();

      res.status(200).json({
        success: true,
        message: '2FA setup initiated',
        data: {
          // qrCode: await qrcode.toDataURL(secret.otpauth_url)
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Enable 2FA',
        userId: req.user?.id 
      });
      next(error);
    }
  }
}

module.exports = new SecurityController();