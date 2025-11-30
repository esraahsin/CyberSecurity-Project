/**
 * User Controller - Gestion des utilisateurs
 * @module controllers/UserController
 */

const userService = require('../services/user.service');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class UserController {
  /**
   * GET /api/users
   * Liste tous les utilisateurs (ADMIN ONLY)
   */
  async listUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, status, role } = req.query;

      // Récupérer les utilisateurs avec pagination
      const result = await userService.listUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        role
      });

      // Log audit
      await auditService.logAction({
        userId: req.user.id,
        action: 'LIST_USERS',
        resourceType: 'user',
        eventType: 'data_access',
        severity: 'info',
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'List Users',
        userId: req.user?.id 
      });
      next(error);
    }
  }

  /**
   * GET /api/users/:id
   * Récupère un utilisateur par ID (ADMIN ou propriétaire)
   */
  async getUserById(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Vérifier les permissions
      if (req.user.role !== 'admin' && requestingUserId !== targetUserId) {
        await auditService.logSecurityEvent({
          userId: requestingUserId,
          event: 'UNAUTHORIZED_USER_ACCESS',
          severity: 'high',
          details: {
            attemptedUserId: targetUserId
          },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only view your own profile'
        });
      }

      const user = await userService.getUserById(targetUserId);

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get User By ID',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * PUT /api/users/:id
   * Met à jour un utilisateur
   */
  async updateUser(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Vérifier les permissions
      if (req.user.role !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updates = req.body;

      // Log audit
      await auditService.logAction({
        userId: requestingUserId,
        action: 'UPDATE_USER',
        resourceType: 'user',
        resourceId: targetUserId,
        eventType: 'data_access',
        severity: 'info',
        ipAddress: req.ip,
        newValues: updates
      });

      const updatedUser = await userService.updateProfile(targetUserId, updates);

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update User',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * DELETE /api/users/:id
   * Supprime un utilisateur (soft delete)
   */
  async deleteUser(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Seul un admin ou l'utilisateur lui-même peut supprimer
      if (req.user.role !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Empêcher la suppression de son propre compte admin
      if (req.user.role === 'admin' && requestingUserId === targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete your own admin account'
        });
      }

      await userService.deleteUser(targetUserId);

      // Log audit
      await auditService.logSecurityEvent({
        userId: requestingUserId,
        event: 'USER_DELETED',
        severity: 'warning',
        details: {
          deletedUserId: targetUserId
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Delete User',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/users/:id/accounts
   * Récupère tous les comptes d'un utilisateur
   */
  async getUserAccounts(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Vérifier les permissions
      if (req.user.role !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const accounts = await userService.getUserAccounts(targetUserId);

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
            createdAt: account.created_at
          })),
          total: accounts.length
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get User Accounts',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/users/:id/stats
   * Récupère les statistiques d'un utilisateur
   */
  async getUserStats(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Vérifier les permissions
      if (req.user.role !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const stats = await userService.getUserStats(targetUserId);

      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Get User Stats',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * PUT /api/users/:id/role
   * Change le rôle d'un utilisateur (ADMIN ONLY)
   */
  async updateUserRole(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const { role } = req.body;

      // Valider le rôle
      const validRoles = ['user', 'admin', 'moderator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Empêcher de changer son propre rôle
      if (targetUserId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change your own role'
        });
      }

      await userService.updateUserRole(targetUserId, role);

      // Log audit
      await auditService.logSecurityEvent({
        userId: req.user.id,
        event: 'USER_ROLE_CHANGED',
        severity: 'high',
        details: {
          targetUserId,
          newRole: role
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update User Role',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * PUT /api/users/:id/status
   * Change le statut d'un utilisateur (ADMIN ONLY)
   */
  async updateUserStatus(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);
      const { status } = req.body;

      // Valider le statut
      const validStatuses = ['active', 'suspended', 'locked', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Empêcher de changer son propre statut
      if (targetUserId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change your own status'
        });
      }

      await userService.updateUserStatus(targetUserId, status);

      // Log audit
      await auditService.logSecurityEvent({
        userId: req.user.id,
        event: 'USER_STATUS_CHANGED',
        severity: status === 'suspended' ? 'high' : 'warning',
        details: {
          targetUserId,
          newStatus: status
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Update User Status',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * GET /api/users/search
   * Recherche d'utilisateurs (ADMIN ONLY)
   */
  async searchUsers(req, res, next) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters'
        });
      }

      const results = await userService.searchUsers(q, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Search Users',
        userId: req.user?.id,
        query: req.query.q
      });
      next(error);
    }
  }

  /**
   * POST /api/users/:id/unlock
   * Déverrouille un compte utilisateur (ADMIN ONLY)
   */
  async unlockUser(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);

      await userService.unlockUser(targetUserId);

      // Log audit
      await auditService.logSecurityEvent({
        userId: req.user.id,
        event: 'USER_UNLOCKED',
        severity: 'info',
        details: {
          targetUserId
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'User unlocked successfully'
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Unlock User',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }

  /**
   * POST /api/users/:id/reset-password
   * Réinitialise le mot de passe d'un utilisateur (ADMIN ONLY)
   */
  async resetUserPassword(req, res, next) {
    try {
      const targetUserId = parseInt(req.params.id);

      // Générer un mot de passe temporaire
      const tempPassword = await userService.resetUserPassword(targetUserId);

      // Log audit
      await auditService.logSecurityEvent({
        userId: req.user.id,
        event: 'PASSWORD_RESET_BY_ADMIN',
        severity: 'high',
        details: {
          targetUserId
        },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        data: {
          temporaryPassword: tempPassword,
          note: 'User must change this password on next login'
        }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'Reset User Password',
        userId: req.user?.id,
        targetUserId: req.params.id
      });
      next(error);
    }
  }
}

module.exports = new UserController();