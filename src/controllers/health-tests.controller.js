const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../db');
const { toIsoDate } = require('../utils/dates');
const { logActivity } = require('../services/activity.service');

const ALLOWED_CERTIFICATE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const RESULT_OPTIONS = {
  ADN: ['Sain', 'Porteur', 'Atteint', 'Indemne', 'Compatible parenté', 'Incompatible parenté'],
  'Dysplasie hanches': ['A', 'B', 'C', 'D', 'E'],
  'Dysplasie coudes': ['ED0', 'ED1', 'ED2', 'ED3'],
  Ophtalmologie: ['Indemne', 'Suspect', 'Atteint', 'À revoir'],
  Cardiaque: ['Normal', 'Anomalie mineure', 'Anomalie majeure', 'À revoir'],
  Autre: ['Sain', 'Porteur', 'Atteint', 'À revoir'],
};

async function ensureHealthTestsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_tests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      dog_id UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
      test_type VARCHAR(80) NOT NULL,
      test_name VARCHAR(160) NOT NULL,
      result VARCHAR(120),
      test_date DATE,
      laboratory VARCHAR(160),
      certificate_url TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function clean(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeResult(testType, result) {
  const raw = clean(result);
  if (!raw) return null;

  const allowed = RESULT_OPTIONS[testType] || RESULT_OPTIONS.Autre;
  const match = allowed.find((item) => item.toLowerCase() === raw.toLowerCase());
  if (match) return match;

  if (testType === 'Dysplasie hanches') {
    const simplified = raw.replace(/^HD[-\s]?/i, '').replace(/\/.*$/, '').toUpperCase();
    if (['A', 'B', 'C', 'D', 'E'].includes(simplified)) return simplified;
  }

  if (testType === 'Dysplasie coudes') {
    const simplified = raw.replace(/^ED[-\s]?/i, 'ED').toUpperCase();
    if (['ED0', 'ED1', 'ED2', 'ED3'].includes(simplified)) return simplified;
  }

  return raw.slice(0, 120);
}

function buildCertificateName(breederId, file) {
  const ext = ALLOWED_CERTIFICATE_TYPES[file.mimetype] || 'bin';
  const safeBreederId = String(breederId).replace(/[^a-zA-Z0-9-]/g, '');
  return `${safeBreederId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

async function saveCertificate(breederId, file) {
  if (!file) return null;
  if (!ALLOWED_CERTIFICATE_TYPES[file.mimetype]) {
    throw new Error('Format justificatif non supporté. Utilisez PDF, JPG, PNG ou WebP.');
  }

  const uploadRoot = path.join(__dirname, '..', 'public', 'uploads', 'health-tests');
  await fs.mkdir(uploadRoot, { recursive: true });
  const filename = buildCertificateName(breederId, file);
  await fs.writeFile(path.join(uploadRoot, filename), file.buffer);
  return `/uploads/health-tests/${filename}`;
}

async function loadDogs(breederId) {
  const result = await pool.query(
    `SELECT id, name, sex, breed, chip_number
     FROM dogs
     WHERE breeder_id = $1
     ORDER BY name ASC`,
    [breederId],
  );
  return result.rows;
}

async function loadTests(breederId, dogId = null) {
  const values = [breederId];
  let dogFilter = '';
  if (dogId) {
    values.push(dogId);
    dogFilter = `AND ht.dog_id = $${values.length}`;
  }

  const result = await pool.query(
    `SELECT ht.*, d.name AS dog_name, d.breed AS dog_breed
     FROM health_tests ht
     INNER JOIN dogs d ON d.id = ht.dog_id
     WHERE ht.breeder_id = $1
       ${dogFilter}
     ORDER BY ht.test_date DESC NULLS LAST, ht.created_at DESC`,
    values,
  );
  return result.rows;
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

exports.listHealthTests = async (req, res) => {
  try {
    await ensureHealthTestsSchema();
    const breederId = req.session.user.breeder_id;
    const dogId = clean(req.query.dog_id);
    const [dogs, tests] = await Promise.all([
      loadDogs(breederId),
      loadTests(breederId, dogId),
    ]);

    res.render('health-tests/index', {
      title: 'Tests de santé',
      dogs,
      tests,
      selectedDogId: dogId || '',
      resultOptions: RESULT_OPTIONS,
    });
  } catch (error) {
    console.error('Erreur tests de santé:', error);
    setFlash(req, 'error', 'Erreur lors du chargement des tests de santé.');
    res.redirect('/dashboard');
  }
};

exports.createHealthTest = async (req, res) => {
  try {
    await ensureHealthTestsSchema();
    const breederId = req.session.user.breeder_id;
    const certificateUrl = await saveCertificate(breederId, req.file);

    const dogId = clean(req.body.dog_id);
    const testType = clean(req.body.test_type);
    const testName = clean(req.body.test_name);
    const testDate = toIsoDate(req.body.test_date);
    const result = normalizeResult(testType, req.body.result);

    if (!dogId || !testType || !testName) {
      setFlash(req, 'error', 'Chien, catégorie et nom du test sont obligatoires.');
      return res.redirect('/health-tests');
    }

    const dogCheck = await pool.query('SELECT id, name FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
    if (!dogCheck.rows.length) {
      setFlash(req, 'error', 'Chien introuvable pour cet élevage.');
      return res.redirect('/health-tests');
    }

    const duplicate = await pool.query(
      `SELECT id FROM health_tests
       WHERE breeder_id = $1
         AND dog_id = $2
         AND test_type IS NOT DISTINCT FROM $3
         AND test_name IS NOT DISTINCT FROM $4
         AND test_date IS NOT DISTINCT FROM $5
       LIMIT 1`,
      [breederId, dogId, testType, testName, testDate],
    );

    if (duplicate.rows.length) {
      setFlash(req, 'warning', 'Ce test de santé existe déjà. Aucun doublon n’a été créé.');
      return res.redirect(`/health-tests?dog_id=${dogId}`);
    }

    const inserted = await pool.query(
      `INSERT INTO health_tests
        (breeder_id, dog_id, test_type, test_name, result, test_date, laboratory, certificate_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        breederId,
        dogId,
        testType,
        testName,
        result,
        testDate,
        clean(req.body.laboratory),
        certificateUrl,
        clean(req.body.notes),
      ],
    );

    await logActivity(pool, {
      breederId,
      userId: req.session.user.id,
      action: 'health_test.created',
      entityType: 'health_test',
      entityId: inserted.rows[0].id,
      label: `${dogCheck.rows[0].name} - ${testType} - ${testName}`,
      metadata: { dogId, testType, testName, result, testDate },
    });

    setFlash(req, 'success', 'Test de santé enregistré avec succès.');
    res.redirect(`/health-tests?dog_id=${dogId}`);
  } catch (error) {
    console.error('Erreur création test santé:', error);
    setFlash(req, 'error', error.message || 'Erreur lors de l’enregistrement du test de santé.');
    res.redirect('/health-tests');
  }
};

exports.deleteHealthTest = async (req, res) => {
  try {
    await ensureHealthTestsSchema();
    const breederId = req.session.user.breeder_id;
    const testId = req.params.id;
    const current = await pool.query(
      'SELECT dog_id, test_type, test_name FROM health_tests WHERE id = $1 AND breeder_id = $2',
      [testId, breederId],
    );
    const dogId = current.rows[0]?.dog_id;

    await pool.query('DELETE FROM health_tests WHERE id = $1 AND breeder_id = $2', [testId, breederId]);
    await logActivity(pool, {
      breederId,
      userId: req.session.user.id,
      action: 'health_test.deleted',
      entityType: 'health_test',
      entityId: testId,
      label: current.rows[0] ? `${current.rows[0].test_type} - ${current.rows[0].test_name}` : null,
    });

    setFlash(req, 'success', 'Test de santé supprimé.');
    res.redirect(dogId ? `/health-tests?dog_id=${dogId}` : '/health-tests');
  } catch (error) {
    console.error('Erreur suppression test santé:', error);
    setFlash(req, 'error', 'Erreur lors de la suppression du test de santé.');
    res.redirect('/health-tests');
  }
};