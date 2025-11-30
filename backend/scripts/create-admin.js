#!/usr/bin/env node

/**
 * Script pour créer un utilisateur administrateur
 * Usage: node backend/scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');

// Charger .env depuis le bon dossier
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('📋 Configuration chargée:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || '5432'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'securebank'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'bankadmin'}`);
console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'NOT SET'}\n`);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'securebank',
  user: process.env.DB_USER || 'bankadmin',
  password: String(process.env.DB_PASSWORD || ''),
});

async function createAdmin() {
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connected!\n');

    console.log('🔧 Creating admin user...\n');

    // Données de l'admin
    const adminData = {
      email: 'admin@securebank.com',
      username: 'admin',
      password: 'Admin123!@#',
      firstName: 'Super',
      lastName: 'Admin',
      phoneNumber: '+1234567890',
      role: 'admin'
    };

    // Vérifier si l'admin existe déjà
    console.log('🔍 Checking if admin already exists...');
    const checkAdmin = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [adminData.email]
    );

    if (checkAdmin.rows.length > 0) {
      console.log('\n⚠️  Admin user already exists!');
      console.log(`   Email: ${checkAdmin.rows[0].email}`);
      console.log(`   ID: ${checkAdmin.rows[0].id}`);
      console.log(`   Role: ${checkAdmin.rows[0].role}\n`);
      
      // Proposer de réinitialiser le mot de passe
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('Do you want to reset the password? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
          try {
            console.log('\n🔒 Hashing new password...');
            const passwordHash = await bcrypt.hash(adminData.password, 12);
            
            await client.query(
              'UPDATE users SET password_hash = $1, role = $2, account_status = $3 WHERE email = $4',
              [passwordHash, 'admin', 'active', adminData.email]
            );
            
            console.log('\n✅ Admin password reset successfully!');
            console.log(`   Email: ${adminData.email}`);
            console.log(`   Password: ${adminData.password}`);
            console.log(`   Role: admin\n`);
          } catch (error) {
            console.error('\n❌ Error resetting password:', error.message);
            console.error('Full error:', error);
          }
        } else {
          console.log('\n⏭️  Skipping password reset.');
        }
        
        readline.close();
        client.release();
        await pool.end();
        process.exit(0);
      });
      
      return;
    }

    // Hasher le mot de passe
    console.log('🔒 Hashing password...');
    const passwordHash = await bcrypt.hash(adminData.password, 12);
    console.log('✅ Password hashed successfully!\n');

    // Créer l'admin
    console.log('💾 Inserting admin into database...');
    const result = await client.query(`
      INSERT INTO users (
        email, username, password_hash, first_name, last_name,
        phone_number, role, account_status, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, username, role, created_at
    `, [
      adminData.email,
      adminData.username,
      passwordHash,
      adminData.firstName,
      adminData.lastName,
      adminData.phoneNumber,
      adminData.role,
      'active',
      true
    ]);

    const admin = result.rows[0];

    console.log('\n✅ Admin user created successfully!\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║        Admin Credentials               ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ ID:       ${String(admin.id).padEnd(30)} ║`);
    console.log(`║ Email:    ${adminData.email.padEnd(30)} ║`);
    console.log(`║ Username: ${adminData.username.padEnd(30)} ║`);
    console.log(`║ Password: ${adminData.password.padEnd(30)} ║`);
    console.log(`║ Role:     ${admin.role.padEnd(30)} ║`);
    console.log('╚════════════════════════════════════════╝\n');

    console.log('⚠️  IMPORTANT: Change this password after first login!\n');

    client.release();
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    console.error('\n📋 Full error details:');
    console.error(error);
    
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

// Gérer les signaux pour une sortie propre
process.on('SIGINT', async () => {
  console.log('\n⏸️  Process interrupted. Cleaning up...');
  await pool.end();
  process.exit(0);
});

createAdmin();