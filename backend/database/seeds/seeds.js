const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runSeeds() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting seeds...\n');
    
    // ✅ Use only 'database/seeds' folder
    const seedsDir = path.join(__dirname); // __dirname is already 'database/seeds'
    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('⚠️ No seed files found in:', seedsDir);
      return;
    }

    for (const file of files) {
      console.log(`📄 Running seed: ${file}`);
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
      
      await client.query(sql);
      console.log(`✅ Completed: ${file}\n`);
    }
    
    console.log('🎉 All seeds completed successfully!');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeds
runSeeds().catch(console.error);
