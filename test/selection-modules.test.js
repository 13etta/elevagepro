const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const modulesPath = require.resolve('../src/config/modules');

function loadModules(flag) {
  const previous = process.env.ENABLE_SELECTION_MODULES;

  if (flag === undefined) delete process.env.ENABLE_SELECTION_MODULES;
  else process.env.ENABLE_SELECTION_MODULES = flag;

  delete require.cache[modulesPath];
  const config = require(modulesPath);
  delete require.cache[modulesPath];

  if (previous === undefined) delete process.env.ENABLE_SELECTION_MODULES;
  else process.env.ENABLE_SELECTION_MODULES = previous;

  return config;
}

test('le nouvel agent IA remplace seul les anciens modules de sélection par défaut', () => {
  const config = loadModules(undefined);

  assert.equal(config.selectionModulesEnabled, false);
  assert.equal(config.aiSelectionAgentEnabled, true);
  assert.equal(config.moduleGroups.some((group) => group.key === 'selection'), true);
  assert.deepEqual(
    config.modules.filter((module) => module.group === 'selection').map((module) => module.key),
    ['selectionAgent'],
  );
});

test('la partie Sélection reste réactivable explicitement', () => {
  const config = loadModules('true');
  const selectionKeys = config.modules
    .filter((module) => module.group === 'selection')
    .map((module) => module.key)
    .sort();

  assert.equal(config.selectionModulesEnabled, true);
  assert.deepEqual(selectionKeys, ['cynognostic', 'genetics', 'selectionAgent', 'strategy']);
});

test('les routes Sélection sont montées uniquement derrière le réglage dédié', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const guardedRoutes = appSource.match(/if \(selectionModulesEnabled\) \{([\s\S]*?)\n\}/);

  assert.ok(guardedRoutes, 'Le bloc conditionnel des routes Sélection doit exister.');
  assert.match(guardedRoutes[1], /app\.use\('\/genetics'/);
  assert.match(guardedRoutes[1], /app\.use\('\/cynognostic'/);
  assert.match(guardedRoutes[1], /app\.use\('\/strategy'/);
});
