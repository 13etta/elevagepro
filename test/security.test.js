const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcrypt');
const ejs = require('ejs');

const { verifyCsrf } = require('../src/middleware/csrf');

const projectRoot = path.resolve(__dirname, '..');

function buildResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, payload) {
      this.payload = { view, payload };
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function runCsrf(request) {
  const response = buildResponse();
  let nextCalled = false;
  verifyCsrf(request, response, () => {
    nextCalled = true;
  });
  return { response, nextCalled };
}

test('CSRF laisse passer les méthodes de lecture', () => {
  const result = runCsrf({ method: 'GET', headers: {}, session: {} });
  assert.equal(result.nextCalled, true);
  assert.equal(result.response.statusCode, 200);
});

test('CSRF accepte un jeton de formulaire valide', () => {
  const token = 'a'.repeat(48);
  const result = runCsrf({
    method: 'POST',
    body: { _csrf: token },
    headers: {},
    session: { csrfToken: token, user: { id: 'user-1' } },
  });
  assert.equal(result.nextCalled, true);
});

test('CSRF refuse un jeton absent ou invalide', () => {
  const result = runCsrf({
    method: 'POST',
    body: { _csrf: 'invalid' },
    headers: {},
    session: { csrfToken: 'a'.repeat(48), user: { id: 'user-1' } },
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.response.payload.view, 'errors/403');
});

test('toutes les routes POST déclarent une protection CSRF', () => {
  const routesDir = path.join(projectRoot, 'src', 'routes');
  const failures = [];

  for (const file of fs.readdirSync(routesDir).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const routerWideProtection = source.includes('router.use(verifyCsrf)');

    source.split('\n').forEach((line, index) => {
      if (!line.includes('router.post(')) return;
      if (!routerWideProtection && !line.includes('verifyCsrf')) {
        failures.push(`${file}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(failures, []);
});

test('aucune action destructive connue ne reste exposée en GET', () => {
  const forbidden = [
    ['auth.routes.js', /router\.get\('\/logout'/],
    ['puppies.routes.js', /router\.get\('\/(?:delete\/:id|:id\/delete)'/],
    ['reminders.routes.js', /router\.get\('\/:id\/(?:complete|reopen|delete)'/],
  ];

  for (const [file, pattern] of forbidden) {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'routes', file), 'utf8');
    assert.doesNotMatch(source, pattern, file);
  }
});

test('les contrôleurs portées et gestations ne modifient plus le schéma au runtime', () => {
  for (const file of ['litters.controller.js', 'pregnancies.controller.js']) {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'controllers', file), 'utf8');
    assert.doesNotMatch(source, /ALTER TABLE|CREATE TABLE|information_schema\.columns/, file);
  }
});

test('bcrypt 6 conserve le parcours mot de passe utilisé par ElevagePro', async () => {
  const password = 'MotDePasse-Test-2026';
  const hash = await bcrypt.hash(password, 10);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare('mauvais-mot-de-passe', hash), false);
});

test('le client Supabase dispose d’un transport WebSocket sous Node.js', () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

  const modulePath = require.resolve('../src/utils/supabase');
  delete require.cache[modulePath];

  try {
    assert.doesNotThrow(() => require('../src/utils/supabase'));
  } finally {
    delete require.cache[modulePath];

    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;

    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test('la mise à niveau EJS compile tous les modèles existants', () => {
  const viewsDir = path.join(projectRoot, 'src', 'views');
  const templates = [];

  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      if (entry.isFile() && entry.name.endsWith('.ejs')) templates.push(fullPath);
    }
  }

  collect(viewsDir);
  assert.ok(templates.length > 0);

  for (const template of templates) {
    const source = fs.readFileSync(template, 'utf8');
    assert.doesNotThrow(() => ejs.compile(source, { filename: template }), template);
  }
});
