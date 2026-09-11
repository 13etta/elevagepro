const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const migrationDirectory = path.resolve(__dirname, '../supabase/migrations');
function migrations() {
  return fs.readdirSync(migrationDirectory).filter(name => /^\d+_.+\.sql$/.test(name)).sort().map(name => {
    const sql = fs.readFileSync(path.join(migrationDirectory, name), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}
async function plan(client) {
  const exists = (await client.query("SELECT to_regclass('app_private.schema_migrations') IS NOT NULL AS present")).rows[0].present;
  const applied = exists ? (await client.query('SELECT name,checksum FROM app_private.schema_migrations')).rows : [];
  const files = migrations();
  for (const entry of applied) {
    const file = files.find(item => item.name === entry.name);
    if (!file || file.checksum !== entry.checksum) throw new Error('Historique de migration modifié : ' + entry.name);
  }
  return files.filter(file => !applied.some(entry => entry.name === file.name));
}
async function apply(client) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query('SELECT pg_advisory_xact_lock(741820260908)');
    if (!(await client.query("SELECT to_regclass('public.breeder') IS NOT NULL AS present")).rows[0].present) {
      throw new Error('Base métier absente. Ce correctif exige une base ElevagePro existante ; aucune initialisation automatique.');
    }
    await client.query("CREATE SCHEMA IF NOT EXISTS app_private; REVOKE ALL ON SCHEMA app_private FROM PUBLIC; CREATE TABLE IF NOT EXISTS app_private.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now()); REVOKE ALL ON app_private.schema_migrations FROM PUBLIC;");
    const pending = await plan(client);
    for (const file of pending) {
      await client.query(file.sql);
      await client.query('INSERT INTO app_private.schema_migrations(name,checksum) VALUES($1,$2)', [file.name, file.checksum]);
    }
    await client.query('COMMIT');
    return pending.map(file => file.name);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function main() {
  require('dotenv').config();
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--apply'].includes(arg)) || (args.includes('--check') && args.includes('--apply'))) throw new Error('Utiliser --check (lecture seule) ou --apply.');
  if (args.includes('--apply')) {
    const hostname = new URL(process.env.DATABASE_URL).hostname;
    if (!process.env.MIGRATION_CONFIRM_HOST || process.env.MIGRATION_CONFIRM_HOST !== hostname) throw new Error('MIGRATION_CONFIRM_HOST doit correspondre exactement à la base sauvegardée et validée en préproduction.');
  }
  const { Pool } = require('pg');
  const { databaseOptions } = require('../src/config/database');
  const pool = new Pool(databaseOptions());
  let client;
  try {
    client = await pool.connect();
    if (args.includes('--apply')) console.log('Migrations appliquées :', await apply(client));
    else {
      await client.query('BEGIN READ ONLY');
      const pending = await plan(client);
      await client.query('COMMIT');
      console.log(pending.length ? 'Migrations à appliquer avant déploiement : ' + pending.map(file => file.name).join(', ') : 'Schéma de livraison à jour.');
      if (pending.length) process.exitCode = 1;
    }
  } finally { client?.release(); await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error('Migration interrompue :', error.code || error.message); process.exitCode = 1; });
module.exports = { migrations, plan, apply };
