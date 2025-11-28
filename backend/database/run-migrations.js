// backend/database/run-migrations.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'securebank',
  user: process.env.DB_USER || 'bankadmin',
  password: String(process.env.DB_PASSWORD || ''), // <<< force string
});


async function runMigrations() {
  try {
    console.log('🔄 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à PostgreSQL');

    // Créer la table de suivi des migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    console.log(`\n📂 ${files.length} fichiers de migration trouvés\n`);

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      // Vérifier si la migration a déjà été exécutée
      const result = await client.query(
        'SELECT * FROM schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  ${file} - Déjà exécutée`);
        continue;
      }

      console.log(`🔄 Exécution: ${file}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Exécuter la migration dans une transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ ${file} - Succès\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ ${file} - Erreur:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 Toutes les migrations ont été exécutées avec succès!\n');

    // Afficher un résumé
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM accounts) as accounts_count,
        (SELECT COUNT(*) FROM transactions) as transactions_count,
        (SELECT COUNT(*) FROM sessions) as sessions_count,
        (SELECT COUNT(*) FROM beneficiaries) as beneficiaries_count,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs_count;
    `);

    console.log('📊 État de la base de données:');
    console.log('─────────────────────────────');
    console.log(`Users:         ${summary.rows[0].users_count}`);
    console.log(`Accounts:      ${summary.rows[0].accounts_count}`);
    console.log(`Transactions:  ${summary.rows[0].transactions_count}`);
    console.log(`Sessions:      ${summary.rows[0].sessions_count}`);
    console.log(`Beneficiaries: ${summary.rows[0].beneficiaries_count}`);
    console.log(`Audit Logs:    ${summary.rows[0].audit_logs_count}`);
    console.log('─────────────────────────────\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution des migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter les migrations
runMigrations();