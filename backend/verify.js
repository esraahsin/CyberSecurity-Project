const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function verify() {
  try {
    console.log('🔍 Verifying database setup...\n');
    
    // Test connexion
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connection: OK');
    console.log(`   Time: ${res.rows[0].now}\n`);
    
    // Vérifier tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log('');
    
    // Compter les données
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const accounts = await pool.query('SELECT COUNT(*) FROM accounts');
    const transactions = await pool.query('SELECT COUNT(*) FROM transactions');
    
    console.log('📈 Data seeded:');
    console.log(`   - Users: ${users.rows[0].count}`);
    console.log(`   - Accounts: ${accounts.rows[0].count}`);
    console.log(`   - Transactions: ${transactions.rows[0].count}`);
    console.log('');
    
    console.log('🎉 Database setup verified successfully!');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await pool.end();
  }
}

verify();