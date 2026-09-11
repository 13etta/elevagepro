const dns = require('dns');
const { Pool } = require('pg');
require('dotenv').config();

// Certains environnements de développement (Codespaces, conteneurs, box opérateur)
// résolvent le host PostgreSQL en IPv6 alors que la sortie IPv6 n'est pas routée.
// On privilégie donc l'IPv4 pour éviter les erreurs ENETUNREACH sur les connexions PG.
dns.setDefaultResultOrder?.('ipv4first');

const { databaseOptions } = require('./config/database');
const pool = new Pool(databaseOptions());

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};