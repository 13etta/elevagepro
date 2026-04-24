const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const files = ['001_schema.sql', '002_indexes.sql', '003_seed.sql'];
  
  console.log('Démarrage des migrations...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Début de transaction
    
    for (const file of files) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Exécution de ${file}...`);
        await client.query(sql);
      }
    }
    
    await client.query('COMMIT'); // Validation
    console.log('Migrations terminées avec succès.');
  } catch (err) {
    await client.query('ROLLBACK'); // Annulation en cas d'erreur
    console.error('Erreur lors des migrations, rollback effectué.', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();