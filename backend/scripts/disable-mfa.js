#!/usr/bin/env node

const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'securebank',
  user: process.env.DB_USER || 'bankadmin',
  password: String(process.env.DB_PASSWORD || ''),
});

async function disableMFA() {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected!\n');

    const username = process.argv[2] || 'admin';

    console.log(`🔍 Looking for user: ${username}`);
    
    const result = await client.query(
      'SELECT id, email, username, mfa_enabled FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User "${username}" not found`);
      client.release();
      await pool.end();
      process.exit(1);
    }

    const user = result.rows[0];
    console.log(`✅ Found user: ${user.email}`);
    console.log(`   MFA Status: ${user.mfa_enabled ? 'ENABLED' : 'DISABLED'}\n`);

    if (!user.mfa_enabled) {
      console.log('ℹ️  MFA is already disabled for this user');
      client.release();
      await pool.end();
      process.exit(0);
    }

    console.log('⚙️  Disabling MFA...');
    await client.query(
      'UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1',
      [user.id]
    );

    console.log('\n✅ MFA disabled successfully!\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║          MFA Disabled                  ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ User:  ${user.username.padEnd(32)} ║`);
    console.log(`║ Email: ${user.email.padEnd(32)} ║`);
    console.log('╚════════════════════════════════════════╝\n');
    console.log('ℹ️  You can now login without MFA verification');

    client.release();
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

disableMFA();