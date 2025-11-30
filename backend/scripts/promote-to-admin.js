#!/usr/bin/env node

const bcrypt = require('bcryptjs');
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

async function promoteToAdmin() {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected!\n');

    // Chercher l'utilisateur avec username = 'admin'
    const result = await client.query(
      'SELECT id, email, username, role FROM users WHERE username = $1',
      ['admin']
    );

    if (result.rows.length === 0) {
      console.log('❌ No user found with username "admin"');
      console.log('   Creating new admin...\n');

      const passwordHash = await bcrypt.hash('Admin123!@#', 12);
      
      const newAdmin = await client.query(`
        INSERT INTO users (
          email, username, password_hash, first_name, last_name,
          role, account_status, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, username, role
      `, [
        'admin@securebank.com',
        'admin',
        passwordHash,
        'Super',
        'Admin',
        'admin',
        'active',
        true
      ]);

      console.log('✅ Admin created successfully!');
      console.log(newAdmin.rows[0]);
    } else {
      const user = result.rows[0];
      console.log('👤 Found user:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Current Role: ${user.role}\n`);

      // Hasher le nouveau mot de passe
      console.log('🔒 Hashing password...');
      const passwordHash = await bcrypt.hash('Admin123!@#', 12);

      // Mettre à jour
      console.log('⬆️  Promoting to admin and resetting password...');
      await client.query(`
        UPDATE users 
        SET 
          role = $1,
          password_hash = $2,
          account_status = $3,
          email_verified = $4
        WHERE id = $5
      `, ['admin', passwordHash, 'active', true, user.id]);

      console.log('\n✅ User promoted to admin successfully!\n');
      console.log('╔════════════════════════════════════════╗');
      console.log('║        Admin Credentials               ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║ Email:    ${user.email.padEnd(30)} ║`);
      console.log(`║ Username: admin                        ║`);
      console.log(`║ Password: Admin123!@#                  ║`);
      console.log(`║ Role:     admin                        ║`);
      console.log('╚════════════════════════════════════════╝\n');
    }

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

promoteToAdmin();