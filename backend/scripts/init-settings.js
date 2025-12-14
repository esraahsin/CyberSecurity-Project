// backend/scripts/init-settings.js
// Run this script to initialize the settings table: node scripts/init-settings.js

const pool = require('../src/config/database');
const SystemSettingsModel = require('../src/models/SystemSettings.model');

async function initializeSettings() {
  console.log('🔧 Initializing system settings...');
  
  try {
    // Create table
    console.log('Creating system_settings table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
        category VARCHAR(50) DEFAULT 'general',
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table created');

    // Create indexes
    console.log('Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
      CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
    `);
    console.log('✅ Indexes created');

    // Create trigger
    console.log('Creating trigger...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_system_settings_updated_at ON system_settings;
      
      CREATE TRIGGER trigger_update_system_settings_updated_at
        BEFORE UPDATE ON system_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_system_settings_updated_at();
    `);
    console.log('✅ Trigger created');

    // Initialize default settings
    console.log('Inserting default settings...');
    await SystemSettingsModel.initializeDefaults();
    console.log('✅ Default settings inserted');

    // Verify
    const settings = await SystemSettingsModel.getAllSettings();
    console.log(`✅ Verified ${settings.length} settings loaded`);

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ System Settings Initialized!      ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Default settings created:');
    settings.forEach(s => {
      console.log(`  • ${s.key} = ${s.value} (${s.category})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing settings:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeSettings();
}

module.exports = initializeSettings;