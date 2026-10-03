const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');

test('uploaded logos are scoped to the breeder, converted and present in every PDF type', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'elevagepro-logo-'));
  process.env.PUBLIC_UPLOAD_DIR = root;
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  const uploads = require('../src/services/uploads.service');
  const { loadLogo, drawLogo, LOGO_SIZE } = require('../src/services/documents/logo.service');
  const breeder = { id: randomUUID(), company_name: 'Élevage exemple' };
  const image = sharp({ create: { width: 160, height: 80, channels: 4, background: '#75552B' } });
  for (const [format, mimetype] of [['png','image/png'], ['jpeg','image/jpeg'], ['webp','image/webp']]) {
    breeder.logo_url = await uploads.uploadPublicImage(breeder.id, { buffer: await image.clone()[format]().toBuffer(), mimetype }, 'logos');
    const logo = await loadLogo(breeder);
    assert.ok(logo);
    const metadata = await sharp(logo).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width / metadata.height, 2);
    assert.equal(await loadLogo({ ...breeder, id: randomUUID() }), null);
  }
  assert.equal(await loadLogo({ ...breeder, logo_url: '/uploads/images/' + breeder.id + '/logos/../../secret.png' }), null);
  assert.equal(await loadLogo({ ...breeder, logo_url: 'http://127.0.0.1/private' }), null);
  const logo = await loadLogo(breeder);
  const previousFetch = global.fetch;
  const previousStorage = process.env.SUPABASE_URL;
  let requests = 0;
  process.env.SUPABASE_URL = 'https://storage.example.test';
  global.fetch = async (url, options) => {
    requests++;
    assert.equal(options.redirect, 'error');
    return new Response(logo, { status: 200 });
  };
  try {
    const legacy = `https://storage.example.test/storage/v1/object/public/logos/${breeder.id}/logos/${randomUUID()}.png`;
    assert.ok(await loadLogo({ ...breeder, logo_url: legacy }));
    assert.equal(await loadLogo({ ...breeder, logo_url: legacy.replace(breeder.id, randomUUID()) }), null);
    assert.equal(await loadLogo({ ...breeder, logo_url: legacy.replace('storage.example.test', 'evil.example.test') }), null);
    assert.equal(requests, 1);
  } finally {
    global.fetch = previousFetch;
    if (previousStorage === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousStorage;
  }
  let placement;
  const doc = { page: { width: 612, margins: { left: 52, right: 52 } }, y: 47, image: (...args) => { placement = args; } };
  drawLogo(doc, logo);
  assert.equal(placement[1], (612 - LOGO_SIZE) / 2);
  assert.equal(placement[2], 47);
  assert.deepEqual(placement[3].fit, [LOGO_SIZE, LOGO_SIZE]);
  assert.equal(doc.y, 47 + LOGO_SIZE + 7);

  const sales = require('../src/services/document.service');
  for (const type of sales.getAllowedDocumentTypes()) {
    const pdf = await sales.generateDocument(type, breeder, { buyer_name: 'Client exemple', price: 1000, sale_date: '2026-10-03' }, { name: 'Chien exemple' });
    assert.match(pdf.toString('latin1'), /\/Subtype \/Image/, type);
  }
  const training = require('../src/services/training-document.service');
  const data = { breeder, job: { quote_number: 'DEV-EXEMPLE', service_label: 'Dressage', price_cents: 120000,
    deposit_cents: 30000, vat_rate: 20, weekdays: [1], details: {}, start_date: '2026-10-05', end_date: '2026-10-09' },
    total: { deposits: 30000, received: 30000 }, number: 'FAC-EXEMPLE', issued_on: '2026-10-03', creditPayment: { amount_cents: 10000 }, payments: [] };
  for (const kind of ['quote', 'contract', 'deposit-invoice', 'invoice', 'credit']) {
    const pdf = await training.generate({ ...data, kind });
    assert.match(pdf.toString('latin1'), /\/Subtype \/Image/, kind);
    if (kind === 'quote') assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 5);
  }
  const plain = await training.generate({ ...data, kind: 'quote', breeder: { ...breeder, logo_url: null } });
  assert.doesNotMatch(plain.toString('latin1'), /\/Subtype \/Image/);
  await fs.writeFile(path.join(uploads.publicRoot, breeder.logo_url.slice('/uploads/'.length)), 'invalid image');
  assert.equal(await loadLogo(breeder), null);
});
