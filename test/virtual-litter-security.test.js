const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

test('les routes de portée virtuelle sont protégées et déclarées avant la route dynamique', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src/routes/selection-agent.routes.js'), 'utf8');
  assert.match(source, /router\.use\(requireAuth, requireAiSelectionOwner\)/);
  assert.match(source, /router\.post\('\/virtual-litters', verifyCsrf/);
  assert.ok(
    source.indexOf("router.get('/virtual-litters/new'") < source.indexOf("router.get('/:id'"),
    'La route /virtual-litters/new doit précéder /:id.',
  );
});

test('les requêtes de portée virtuelle imposent toutes le breeder_id', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src/controllers/selection-virtual-litter.controller.js'), 'utf8');
  const queries = [...source.matchAll(/`([\s\S]*?)`/g)]
    .map((match) => match[1])
    .filter((sql) => /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(sql));

  assert.ok(queries.length >= 4);
  for (const query of queries) assert.match(query, /breeder_id/, query);
});

test('la migration protège les portées par clés étrangères composites et RLS', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'sql/023_selection_virtual_litters.sql'), 'utf8');
  assert.match(source, /FOREIGN KEY \(sire_analysis_id, breeder_id\)/);
  assert.match(source, /FOREIGN KEY \(dam_analysis_id, breeder_id\)/);
  assert.match(source, /ALTER TABLE selection_virtual_litters ENABLE ROW LEVEL SECURITY/);
  assert.match(source, /REVOKE ALL ON TABLE selection_virtual_litters FROM anon/);
  assert.match(source, /REVOKE ALL ON TABLE selection_virtual_litters FROM authenticated/);
});
