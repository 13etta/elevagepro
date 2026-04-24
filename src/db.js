const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};