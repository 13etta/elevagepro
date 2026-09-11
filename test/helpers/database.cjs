const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
// Isolated PostgreSQL engine: never reads DATABASE_URL or connects to Supabase.
async function database() {
  const engine = new PGlite({ extensions: { uuid_ossp } });
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  const client = {
    async query(sql, params) {
      if (params?.length) return engine.query(sql, params);
      const results = await engine.exec(sql);
      return results.at(-1) || { rows: [] };
    },
    release() {},
  };
  const history = ['001_schema.sql','002_indexes.sql','004_dog_photos.sql','005_puppy_commercial_fields.sql','006_sales_reservations.sql','007_litter_status_fields.sql','008_pregnancy_compatibility_fields.sql','009_dashboard_compatibility_fields.sql','010_stabilization_dogs_registry.sql','011_health_tests.sql','012_registry_automation.sql','014_registry_litter_events.sql','019_cynognostic_core.sql','020_calendar_events.sql','021_calendar_fk_indexes.sql','022_ai_selection_agent.sql','023_selection_virtual_litters.sql'];
  for (const file of history) await client.query(fs.readFileSync(path.resolve(__dirname, '../../sql', file), 'utf8'));
  return { engine, client };
}
module.exports = { database };
