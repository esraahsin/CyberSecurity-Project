// backend/src/models/SystemSettings.model.js
const pool = require('../config/database');
const logger = require('../utils/logger');

class SystemSettingsModel {
  /**
   * Get a setting by key
   */
  static async getSetting(key) {
    try {
      const result = await pool.query(
        'SELECT * FROM system_settings WHERE key = $1',
        [key]
      );
      
      if (result.rows.length === 0) return null;
      
      const setting = result.rows[0];
      // Parse JSON values
      return {
        key: setting.key,
        value: setting.value_type === 'json' ? JSON.parse(setting.value) : setting.value,
        valueType: setting.value_type,
        category: setting.category,
        description: setting.description,
        updatedAt: setting.updated_at,
        updatedBy: setting.updated_by
      };
    } catch (error) {
      logger.error('Get setting error', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get all settings, optionally filtered by category
   */
  static async getAllSettings(category = null) {
    try {
      let query = 'SELECT * FROM system_settings';
      const params = [];
      
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY category, key';
      
      const result = await pool.query(query, params);
      
      return result.rows.map(setting => ({
        key: setting.key,
        value: setting.value_type === 'json' ? JSON.parse(setting.value) : setting.value,
        valueType: setting.value_type,
        category: setting.category,
        description: setting.description,
        updatedAt: setting.updated_at,
        updatedBy: setting.updated_by
      }));
    } catch (error) {
      logger.error('Get all settings error', { error: error.message });
      throw error;
    }
  }

  /**
   * Set a setting value
   */
  static async setSetting(key, value, valueType, userId, category = 'general', description = null) {
    try {
      const stringValue = valueType === 'json' ? JSON.stringify(value) : String(value);
      
      const result = await pool.query(
        `INSERT INTO system_settings (key, value, value_type, category, description, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) 
         DO UPDATE SET 
           value = EXCLUDED.value,
           value_type = EXCLUDED.value_type,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [key, stringValue, valueType, category, description, userId]
      );
      
      const setting = result.rows[0];
      return {
        key: setting.key,
        value: setting.value_type === 'json' ? JSON.parse(setting.value) : setting.value,
        valueType: setting.value_type,
        category: setting.category,
        description: setting.description,
        updatedAt: setting.updated_at,
        updatedBy: setting.updated_by
      };
    } catch (error) {
      logger.error('Set setting error', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   */
  static async updateMany(settings, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const updated = [];
      
      for (const setting of settings) {
        const result = await this.setSetting(
          setting.key,
          setting.value,
          setting.valueType || 'string',
          userId,
          setting.category || 'general',
          setting.description
        );
        updated.push(result);
      }
      
      await client.query('COMMIT');
      
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Update many settings error', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(key) {
    try {
      const result = await pool.query(
        'DELETE FROM system_settings WHERE key = $1 RETURNING *',
        [key]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Delete setting error', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get settings by category as an object
   */
  static async getSettingsByCategory(category) {
    try {
      const settings = await this.getAllSettings(category);
      
      return settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
    } catch (error) {
      logger.error('Get settings by category error', { error: error.message, category });
      throw error;
    }
  }

  /**
   * Initialize default settings if they don't exist
   */
  static async initializeDefaults() {
    const defaults = [
      // Security Settings
      { key: 'max_login_attempts', value: '5', valueType: 'number', category: 'security', description: 'Maximum login attempts before account lock' },
      { key: 'account_lock_duration', value: '30', valueType: 'number', category: 'security', description: 'Account lock duration in minutes' },
      { key: 'session_timeout', value: '24', valueType: 'number', category: 'security', description: 'Session timeout in hours' },
      { key: 'mfa_required', value: 'false', valueType: 'boolean', category: 'security', description: 'Require MFA for all users' },
      { key: 'password_min_length', value: '8', valueType: 'number', category: 'security', description: 'Minimum password length' },
      
      // Transaction Settings
      { key: 'daily_transfer_limit', value: '10000', valueType: 'number', category: 'transactions', description: 'Default daily transfer limit in dollars' },
      { key: 'max_transaction_amount', value: '100000', valueType: 'number', category: 'transactions', description: 'Maximum single transaction amount in dollars' },
      { key: 'fraud_detection_enabled', value: 'true', valueType: 'boolean', category: 'transactions', description: 'Enable fraud detection system' },
      { key: 'fraud_threshold', value: '70', valueType: 'number', category: 'transactions', description: 'Fraud score threshold (0-100)' },
      
      // System Settings
      { key: 'maintenance_mode', value: 'false', valueType: 'boolean', category: 'system', description: 'Enable maintenance mode' },
      { key: 'debug_mode', value: 'false', valueType: 'boolean', category: 'system', description: 'Enable debug mode' },
      { key: 'api_rate_limit', value: '100', valueType: 'number', category: 'system', description: 'API rate limit per minute' },
    ];

    try {
      for (const setting of defaults) {
        const existing = await this.getSetting(setting.key);
        if (!existing) {
          await pool.query(
            `INSERT INTO system_settings (key, value, value_type, category, description, updated_by)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [setting.key, setting.value, setting.valueType, setting.category, setting.description]
          );
        }
      }
      
      logger.info('Default system settings initialized');
    } catch (error) {
      logger.error('Initialize defaults error', { error: error.message });
      throw error;
    }
  }
}

module.exports = SystemSettingsModel;