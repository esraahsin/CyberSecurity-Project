// backend/src/services/settings.service.js
const SystemSettingsModel = require('../models/SystemSettings.model');
const logger = require('../utils/logger');

class SettingsService {
  /**
   * Get all settings grouped by category
   */
  async getAllSettings() {
    try {
      const settings = await SystemSettingsModel.getAllSettings();
      
      // Group by category
      const grouped = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = {
          value: setting.value,
          valueType: setting.valueType,
          description: setting.description,
          updatedAt: setting.updatedAt,
          updatedBy: setting.updatedBy
        };
        return acc;
      }, {});
      
      return grouped;
    } catch (error) {
      logger.error('Get all settings error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(category) {
    try {
      return await SystemSettingsModel.getSettingsByCategory(category);
    } catch (error) {
      logger.error('Get settings by category error', { error: error.message, category });
      throw error;
    }
  }

  /**
   * Get a single setting
   */
  async getSetting(key) {
    try {
      const setting = await SystemSettingsModel.getSetting(key);
      return setting ? setting.value : null;
    } catch (error) {
      logger.error('Get setting error', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Update settings
   */
  async updateSettings(updates, userId) {
    try {
      const settingsToUpdate = [];
      
      // Parse the updates and prepare them
      for (const [key, value] of Object.entries(updates)) {
        let valueType = typeof value;
        let finalValue = value;
        
        // Convert boolean strings to actual booleans
        if (value === 'true' || value === 'false') {
          finalValue = value === 'true';
          valueType = 'boolean';
        } else if (!isNaN(value) && value !== '') {
          finalValue = Number(value);
          valueType = 'number';
        } else if (typeof value === 'object') {
          valueType = 'json';
        } else {
          valueType = 'string';
        }
        
        // Determine category based on key
        let category = 'general';
        if (key.includes('login') || key.includes('lock') || key.includes('session') || key.includes('mfa') || key.includes('password')) {
          category = 'security';
        } else if (key.includes('transfer') || key.includes('transaction') || key.includes('fraud')) {
          category = 'transactions';
        } else if (key.includes('maintenance') || key.includes('debug') || key.includes('api')) {
          category = 'system';
        }
        
        settingsToUpdate.push({
          key,
          value: finalValue,
          valueType,
          category
        });
      }
      
      const updated = await SystemSettingsModel.updateMany(settingsToUpdate, userId);
      
      logger.info('Settings updated', { 
        userId, 
        count: updated.length,
        keys: updated.map(s => s.key)
      });
      
      return updated;
    } catch (error) {
      logger.error('Update settings error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Apply settings to the system
   * This method actually enforces the settings
   */
  async applySettings() {
    try {
      const settings = await this.getAllSettings();
      
      // Apply security settings
      if (settings.security) {
        if (settings.security.max_login_attempts) {
          process.env.MAX_LOGIN_ATTEMPTS = String(settings.security.max_login_attempts.value);
        }
        if (settings.security.account_lock_duration) {
          process.env.ACCOUNT_LOCK_DURATION = String(settings.security.account_lock_duration.value);
        }
        if (settings.security.session_timeout) {
          process.env.SESSION_TIMEOUT = String(settings.security.session_timeout.value);
        }
      }
      
      // Apply transaction settings
      if (settings.transactions) {
        if (settings.transactions.fraud_detection_enabled) {
          process.env.FRAUD_DETECTION_ENABLED = String(settings.transactions.fraud_detection_enabled.value);
        }
        if (settings.transactions.fraud_threshold) {
          process.env.FRAUD_THRESHOLD = String(settings.transactions.fraud_threshold.value);
        }
      }
      
      // Apply system settings
      if (settings.system) {
        if (settings.system.maintenance_mode) {
          process.env.MAINTENANCE_MODE = String(settings.system.maintenance_mode.value);
        }
        if (settings.system.debug_mode) {
          process.env.DEBUG_MODE = String(settings.system.debug_mode.value);
        }
      }
      
      logger.info('Settings applied to system');
      
      return true;
    } catch (error) {
      logger.error('Apply settings error', { error: error.message });
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(userId) {
    try {
      await SystemSettingsModel.initializeDefaults();
      await this.applySettings();
      
      logger.info('Settings reset to defaults', { userId });
      
      return true;
    } catch (error) {
      logger.error('Reset to defaults error', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate setting value
   */
  validateSetting(key, value) {
    const validations = {
      max_login_attempts: (v) => v >= 1 && v <= 10,
      account_lock_duration: (v) => v >= 5 && v <= 1440,
      session_timeout: (v) => v >= 1 && v <= 168,
      password_min_length: (v) => v >= 6 && v <= 128,
      daily_transfer_limit: (v) => v >= 100 && v <= 1000000,
      max_transaction_amount: (v) => v >= 1 && v <= 10000000,
      fraud_threshold: (v) => v >= 0 && v <= 100,
      api_rate_limit: (v) => v >= 10 && v <= 1000,
    };
    
    if (validations[key]) {
      return validations[key](value);
    }
    
    return true;
  }
}

module.exports = new SettingsService();