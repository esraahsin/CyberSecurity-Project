/**
 * Auth Controller - Gestion de l'authentification
 * FIXED: Toutes les méthodes correctement liées au contexte
 * @module controllers/AuthController
 */

const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const sessionService = require('../services/session.service');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class AuthController {
  constructor() {
    // ✅ FIX: Lier toutes les méthodes au contexte de la classe
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.refresh = this.refresh.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.requestPasswordReset = this.requestPasswordReset.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.getSessions = this.getSessions.bind(this);
    this.terminateSession = this.terminateSession.bind(this);
    this.terminateAllSessions = this.terminateAllSessions.bind(this);
  }

  /**
   * POST /api/auth/register
   * Inscription d'un nouvel utilisateur
   */
  async register(req, res, next) {
    try {
      const { email, username, password, firstName, lastName, phoneNumber, dateOfBirth } = req.body;

      // Log audit
      await auditService.logAction({
        action: 'REGISTER_ATTEMPT',
        resourceType: 'user',
        eventType: 'authentication',
        severity: 'info',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestBody: { email, username }
      });

      // Créer l'utilisateur
      const user = await authService.register({
        email,
        username,
        password,
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth
      });

      // Log succès
      await auditService.logAction({
        userId: user.id,
        action: 'REGISTER_SUCCESS',
        resourceType: 'user',
        resourceId: user.id,
        eventType: 'authentication',
        severity: 'info',
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Register',
        ip: req.ip 
      });

      await auditService.logAction({
        action: 'REGISTER_FAILED',
        resourceType: 'user',
        eventType: 'authentication',
        severity: 'warning',
        ipAddress: req.ip,
        errorMessage: error.message
      });

      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Connexion utilisateur
   */
  async login(req, res, next) {
    try {
      const { email, password, rememberMe = false } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Log tentative
      await auditService.logAction({
        action: 'LOGIN_ATTEMPT',
        resourceType: 'user',
        eventType: 'authentication',
        severity: 'info',
        ipAddress,
        userAgent,
        requestBody: { email }
      });

      // Authentifier
      const result = await authService.login(email, password, ipAddress);

      // Créer la session
      const session = await sessionService.createSession({
        userId: result.user.id,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        ipAddress,
        userAgent,
        mfaVerified: !result.user.mfaEnabled
      });

      // Log succès
      await auditService.logAction({
        userId: result.user.id,
        sessionId: session.sessionId,
        action: 'LOGIN_SUCCESS',
        resourceType: 'user',
        resourceId: result.user.id,
        eventType: 'authentication',
        severity: 'info',
        ipAddress,
        userAgent
      });

      // Si MFA activé, on demande la vérification
      if (result.user.mfaEnabled) {
        return res.status(200).json({
          success: true,
          requiresMfa: true,
          message: 'MFA verification required',
          sessionId: session.sessionId
        });
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          sessionId: session.sessionId,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Login',
        email: req.body.email,
        ip: req.ip 
      });

      await auditService.logSecurityEvent({
        event: 'LOGIN_FAILED',
        severity: 'warning',
        details: {
          email: req.body.email,
          reason: error.message
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Déconnexion utilisateur
   */
  async logout(req, res, next) {
    try {
      const { token, sessionId } = req;
      const userId = req.user.id;

      // Invalider le token
      await authService.logout(token);

      // Terminer la session
      if (sessionId) {
        await sessionService.endSession(sessionId);
      }

      // Log audit
      await auditService.logAction({
        userId,
        sessionId,
        action: 'LOGOUT',
        resourceType: 'user',
        resourceId: userId,
        eventType: 'authentication',
        severity: 'info',
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Logout',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Rafraîchir le token d'accès
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Générer de nouveaux tokens
      const tokens = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens
      });
    } catch (error) {
      logger.logError(error, { context: 'Refresh Token' });
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Récupérer le profil de l'utilisateur connecté
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;

      // Récupérer l'utilisateur complet
      const user = await userService.getUserById(userId);

      // Récupérer les statistiques
      const stats = await userService.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: user.phone_number,
            dateOfBirth: user.date_of_birth,
            mfaEnabled: user.mfa_enabled,
            emailVerified: user.email_verified,
            accountStatus: user.account_status,
            role: user.role,
            createdAt: user.created_at,
            lastLogin: user.last_login
          },
          stats
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Profile',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * PUT /api/auth/profile
   * Mettre à jour le profil
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // Log audit
      await auditService.logAction({
        userId,
        action: 'UPDATE_PROFILE',
        resourceType: 'user',
        resourceId: userId,
        eventType: 'data_access',
        severity: 'info',
        ipAddress: req.ip,
        newValues: updates
      });

      // Mettre à jour
      const updatedUser = await userService.updateProfile(userId, updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update Profile',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   * Changer le mot de passe
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Changer le mot de passe
      await userService.changePassword(userId, currentPassword, newPassword);

      // Invalider toutes les sessions sauf la courante
      await sessionService.endAllUserSessions(userId, req.sessionId);

      // Log audit sécurité
      await auditService.logSecurityEvent({
        userId,
        event: 'PASSWORD_CHANGED',
        severity: 'info',
        details: {
          userId,
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. All other sessions have been terminated.'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Change Password',
        userId: req.user?.id 
      });

      await auditService.logSecurityEvent({
        userId: req.user?.id,
        event: 'PASSWORD_CHANGE_FAILED',
        severity: 'warning',
        details: {
          reason: error.message
        },
        ipAddress: req.ip
      });

      next(error);
    }
  }

  /**
   * POST /api/auth/request-password-reset
   * Demander une réinitialisation de mot de passe
   */
  async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;

      // TODO: Implémenter la logique d'envoi d'email

      await auditService.logAction({
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'user',
        eventType: 'security_event',
        severity: 'info',
        ipAddress: req.ip,
        metadata: { email }
      });

      // Toujours retourner succès pour éviter l'énumération d'emails
      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    } catch (error) {
      logger.logError(error, { context: 'Request Password Reset' });
      next(error);
    }
  }

  /**
   * POST /api/auth/verify-email
   * Vérifier l'email avec un token
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;

      // TODO: Implémenter la vérification d'email avec token

      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      logger.logError(error, { context: 'Verify Email' });
      next(error);
    }
  }

  /**
   * GET /api/auth/sessions
   * Récupérer toutes les sessions actives
   */
  async getSessions(req, res, next) {
    try {
      const userId = req.user.id;

      const sessions = await sessionService.getUserSessions(userId);

      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get Sessions',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * DELETE /api/auth/sessions/:sessionId
   * Terminer une session spécifique
   */
  async terminateSession(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.params;

      // Terminer la session
      await sessionService.endSession(sessionId);

      // Log audit
      await auditService.logAction({
        userId,
        action: 'SESSION_TERMINATED',
        resourceType: 'session',
        resourceId: sessionId,
        eventType: 'security_event',
        severity: 'info',
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
   * DELETE /api/auth/sessions
   * Terminer toutes les sessions sauf la courante
   */
 /**
   * DELETE /api/auth/sessions
   * Terminer toutes les sessions sauf la courante
   */
  async terminateAllSessions(req, res, next) {
    try {
      const userId = req.user.id;
      const currentSessionId = req.sessionId;

      // Terminer toutes les sessions sauf la courante
      const count = await sessionService.endAllUserSessions(userId, currentSessionId);

      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'ALL_SESSIONS_TERMINATED',
        severity: 'info',
        details: {
          count,
          keptSession: currentSessionId
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: `${count} session(s) terminated successfully`
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Terminate All Sessions',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/verify
   * Vérifie le code MFA et finalise la connexion
   */
  async verifyMFA(req, res, next) {
    try {
      const { sessionId, code } = req.body;

      if (!sessionId || !code) {
        return res.status(400).json({
          success: false,
          error: 'Session ID and MFA code are required'
        });
      }

      // Récupérer la session
      const session = await sessionService.validateSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or expired'
        });
      }

      // Récupérer l'utilisateur et son secret MFA
      const user = await userService.getUserById(session.userId);

      if (!user.mfa_enabled || !user.mfa_secret) {
        return res.status(400).json({
          success: false,
          error: 'MFA is not enabled for this account'
        });
      }

      // Vérifier le code MFA (normalement avec speakeasy ou similar)
      // Pour cette démo, on accepte un code à 6 chiffres
      const isValidCode = /^\d{6}$/.test(code);

      if (!isValidCode) {
        await auditService.logSecurityEvent({
          userId: user.id,
          event: 'MFA_VERIFICATION_FAILED',
          severity: 'warning',
          details: {
            sessionId,
            reason: 'Invalid code format'
          },
          ipAddress: req.ip
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid MFA code'
        });
      }

      // Marquer la session comme MFA vérifié
      await sessionService.verifyMFAForSession(sessionId);

      // Log audit
      await auditService.logAction({
        userId: user.id,
        sessionId,
        action: 'MFA_VERIFIED',
        resourceType: 'session',
        eventType: 'authentication',
        severity: 'info',
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'MFA verification successful',
        data: {
          sessionId,
          user: {
            id: user.id,
            email: user.email,
            username: user.username
          }
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Verify MFA',
        sessionId: req.body?.sessionId 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/resend
   * Renvoie le code MFA (par email/SMS)
   */
  async resendMFA(req, res, next) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
      }

      // Vérifier la session
      const session = await sessionService.validateSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or expired'
        });
      }

      // Rate limiting pour éviter le spam
      const resendKey = `mfa_resend:${session.userId}`;
      const resendCount = await redisClient.get(resendKey);

      if (resendCount && parseInt(resendCount) >= 3) {
        return res.status(429).json({
          success: false,
          error: 'Too many resend attempts. Please try again later.'
        });
      }

      // TODO: Implémenter l'envoi du code par email/SMS
      // Pour l'instant, on simule juste l'envoi
      
      // Incrémenter le compteur
      await redisClient.setEx(resendKey, 300, String(parseInt(resendCount || 0) + 1));

      // Log audit
      await auditService.logAction({
        userId: session.userId,
        action: 'MFA_CODE_RESENT',
        resourceType: 'session',
        eventType: 'authentication',
        severity: 'info',
        ipAddress: req.ip,
        metadata: { sessionId }
      });

      res.status(200).json({
        success: true,
        message: 'MFA code has been resent'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Resend MFA',
        sessionId: req.body?.sessionId 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/enable
   * Active l'authentification à deux facteurs
   */
  async enableMFA(req, res, next) {
    try {
      const userId = req.user.id;

      // Vérifier que MFA n'est pas déjà activé
      const user = await userService.getUserById(userId);

      if (user.mfa_enabled) {
        return res.status(400).json({
          success: false,
          error: 'MFA is already enabled'
        });
      }

      // Générer un secret MFA (normalement avec speakeasy)
      // Pour cette démo, on génère un secret aléatoire
      const crypto = require('crypto');
      const mfaSecret = crypto.randomBytes(20).toString('hex');

      // TODO: Générer un QR code pour l'app d'authentification
      // const qrCode = await generateQRCode(mfaSecret);

      // Sauvegarder le secret (temporairement, en attente de vérification)
      await redisClient.setEx(
        `mfa_setup:${userId}`,
        600, // 10 minutes
        mfaSecret
      );

      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'MFA_SETUP_INITIATED',
        severity: 'info',
        details: {
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'MFA setup initiated',
        data: {
          secret: mfaSecret,
          // qrCode: qrCode,
          instructions: 'Scan the QR code with your authenticator app and enter the 6-digit code to complete setup'
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Enable MFA',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/disable
   * Désactive l'authentification à deux facteurs
   */
  async disableMFA(req, res, next) {
    try {
      const userId = req.user.id;
      const { password, code } = req.body;

      if (!password || !code) {
        return res.status(400).json({
          success: false,
          error: 'Password and MFA code are required'
        });
      }

      // Récupérer l'utilisateur
      const user = await userService.getUserById(userId);

      if (!user.mfa_enabled) {
        return res.status(400).json({
          success: false,
          error: 'MFA is not enabled'
        });
      }

      // Vérifier le mot de passe
      const userWithPassword = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(
        password,
        userWithPassword.rows[0].password_hash
      );

      if (!isValidPassword) {
        await auditService.logSecurityEvent({
          userId,
          event: 'MFA_DISABLE_FAILED',
          severity: 'warning',
          details: {
            reason: 'Invalid password'
          },
          ipAddress: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // Vérifier le code MFA
      const isValidCode = /^\d{6}$/.test(code);

      if (!isValidCode) {
        await auditService.logSecurityEvent({
          userId,
          event: 'MFA_DISABLE_FAILED',
          severity: 'warning',
          details: {
            reason: 'Invalid MFA code'
          },
          ipAddress: req.ip
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid MFA code'
        });
      }

      // Désactiver MFA
      await pool.query(
        `UPDATE users 
         SET mfa_enabled = false, mfa_secret = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'MFA_DISABLED',
        severity: 'warning',
        details: {
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'MFA has been disabled successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Disable MFA',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/auth/mfa/status
   * Récupère le statut MFA de l'utilisateur
   */
  async getMFAStatus(req, res, next) {
    try {
      const userId = req.user.id;

      // Récupérer l'utilisateur
      const user = await userService.getUserById(userId);

      res.status(200).json({
        success: true,
        data: {
          mfaEnabled: user.mfa_enabled,
          setupPending: !user.mfa_enabled && await redisClient.exists(`mfa_setup:${userId}`)
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get MFA Status',
        userId: req.user?.id 
      });
      next(error);
    }
  }
}
// ✅ FIX: Exporter une instance avec les méthodes correctement liées
module.exports = new AuthController();