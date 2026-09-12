const fs = require('node:fs');
const path = require('node:path');
const { migrations } = require('./migrate');

function buildManualUpgrade() {
  const blocks = migrations().map((migration, index) => {
    const delimiter = '$migration_payload_' + index + '$';
    if (migration.sql.includes(delimiter)) throw new Error('SQL delimiter collision');
    return `
DO $release_step_${index}$
BEGIN
  IF EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '${migration.name}' AND checksum <> '${migration.checksum}') THEN
    RAISE EXCEPTION 'Migration already recorded with a different checksum: ${migration.name}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_private.schema_migrations WHERE name = '${migration.name}') THEN
    EXECUTE ${delimiter}
${migration.sql}
${delimiter};
    INSERT INTO app_private.schema_migrations (name, checksum)
    VALUES ('${migration.name}', '${migration.checksum}');
  END IF;
END;
$release_step_${index}$;
`;
  });
  return `-- ElevagePro: mise a niveau additive de la base existante.
-- Executer TOUT ce fichier dans Supabase > SQL Editor, role postgres.
-- Aucune suppression de table, colonne ou donnee metier.
-- Les colonnes existantes et leurs valeurs sont conservees.
-- Les nouvelles lignes de facturation donnent l'acces beta aux eleveurs existants.
-- Tout est annule automatiquement si une instruction echoue.
-- Si le verrou est indisponible, relancer plus tard : ne pas retirer la transaction.
-- Genere a partir des migrations versionnees; ne pas executer les anciens SQL 001-023.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(741820260908);
DO $check_existing_database$
BEGIN
  IF to_regclass('public.breeder') IS NULL OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Base ElevagePro existante introuvable. Aucune initialisation effectuee.';
  END IF;
END;
$check_existing_database$;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS app_private.schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.schema_migrations FROM PUBLIC;
${blocks.join('\n')}
COMMIT;

-- Verification finale: trois migrations enregistrees, tables et colonne presentes.
SELECT name, applied_at FROM app_private.schema_migrations ORDER BY name;
SELECT
  to_regclass('public.billing_accounts') IS NOT NULL AS abonnements_presents,
  to_regclass('app_private.auth_rate_limits') IS NOT NULL AS protection_connexion_presente,
  to_regclass('app_private.account_tokens') IS NOT NULL AS recuperation_compte_presente,
  to_regclass('app_private.billing_events') IS NOT NULL AS evenements_paiement_presents,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='session_version') AS version_session_presente;
`;
}
if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, 'SUPABASE_MISE_A_NIVEAU_SANS_SUPPRESSION.sql'), buildManualUpgrade());
  console.log('Script SQL genere. Aucune connexion a une base de donnees.');
}
module.exports = { buildManualUpgrade };
