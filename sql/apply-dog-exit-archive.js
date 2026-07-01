const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sqlPath = path.join(__dirname, '017_dog_exit_archiving.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Migration archivage des chiens appliquée.');
}

run()
  .catch((error) => {
    console.error('Échec migration archivage des chiens:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
