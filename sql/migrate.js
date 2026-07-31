const dns = require('dns');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Codespaces et certains conteneurs peuvent résoudre PostgreSQL en IPv6
// alors que le réseau sortant IPv6 est indisponible.
// On force donc la résolution IPv4 sauf désactivation explicite.
dns.setDefaultResultOrder?.('ipv4first');

if (process.env.PG_FORCE_IPV4 !== 'false') {
  const originalLookup = dns.lookup.bind(dns);
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      return originalLookup(hostname, { family: 4 }, options);
    }

    return originalLookup(hostname, { ...(options || {}), family: 4 }, callback);
  };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigrations() {
  const files = [
    '001_schema.sql',
    '002_indexes.sql',
    ...(process.env.RUN_DEMO_SEED === 'true' ? ['003_seed.sql'] : []),
    '004_dog_photos.sql',
    '005_puppy_commercial_fields.sql',
    '006_sales_reservations.sql',
    '007_litter_status_fields.sql',
    '008_pregnancy_compatibility_fields.sql',
    '009_dashboard_compatibility_fields.sql',
    '010_stabilization_dogs_registry.sql',
    '011_health_tests.sql',
    '012_registry_automation.sql',
    '013_registry_backfill_existing_dogs.sql',
    '014_registry_litter_events.sql',
    '019_cynognostic_core.sql',
    '020_calendar_events.sql',
    '021_calendar_fk_indexes.sql',
  ];

  console.log('Démarrage des migrations...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const file of files) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Exécution de ${file}...`);
        await client.query(sql);
      }
    }

    await client.query('COMMIT');
    console.log('Migrations terminées avec succès.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors des migrations, rollback effectué.', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
