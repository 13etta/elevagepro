const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const ssl = process.env.DATABASE_SSL === 'false'
  ? false
  : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};