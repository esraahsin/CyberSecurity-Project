// backend/src/controllers/SettingsController.js
const settingsService = require('../services/settings.service');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class SettingsController {
  /**
   * GET /api/admin/settings
   * Get all system settings
   */
  async getSettings(req, res, next) {
    try {
      const settings = await settingsService.getAllSettings();
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.logError(error, { context: 'Get Settings' });
      next(error);
    }
  }

  /**
   * GET /api/admin/settings/:category
   * Get settings by category
   */
  async getSettingsByCategory(req, res, next) {
    try {
      const { category } = req.params;
      
      const settings = await settingsService.getSettingsByCategory(category);
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.logError(error, { context: 'Get Settings By Category' });
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings
   * Update system settings
   */
  async updateSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.body;
      
      // Validate all settings
      const invalidSettings = [];
      for (const [key, value] of Object.entries(updates)) {
        if (!settingsService.validateSetting(key, value)) {
          invalidSettings.push(key);
        }
      }
      
      if (invalidSettings.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid setting values',
          invalid: invalidSettings
        });
      }
      
      // Update settings
      const updated = await settingsService.updateSettings(updates, userId);
      
      // Apply settings to the system
      await settingsService.applySettings();
      
      // Log audit
      await auditService.logAction({
        userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        resourceType: 'system_settings',
        eventType: 'configuration_change',
        severity: 'warning',
        ipAddress: req.ip,
        newValues: updates
      });
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: updated
      });
    } catch (error) {
      logger.logError(error, { context: 'Update Settings', userId: req.user?.id });
      next(error);
    }
  }

  /**
   * POST /api/admin/settings/reset
   * Reset settings to defaults
   */
  async resetToDefaults(req, res, next) {
    try {
      const userId = req.user.id;
      
      await settingsService.resetToDefaults(userId);
      
      // Log audit
      await auditService.logSecurityEvent({
        userId,
        event: 'RESET_SYSTEM_SETTINGS',
        severity: 'high',
        details: {
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip
      });
      
      res.json({
        success: true,
        message: 'Settings reset to defaults'
      });
    } catch (error) {
      logger.logError(error, { context: 'Reset Settings', userId: req.user?.id });
      next(error);
    }
  }

  /**
   * GET /api/admin/settings/apply
   * Manually apply settings (useful after restart)
   */
  async applySettings(req, res, next) {
    try {
      await settingsService.applySettings();
      
      res.json({
        success: true,
        message: 'Settings applied successfully'
      });
    } catch (error) {
      logger.logError(error, { context: 'Apply Settings' });
      next(error);
    }
  }
}

module.exports = new SettingsController();