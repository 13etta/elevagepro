const { pool } = require('../db');
const { assertIsoDate } = require('../utils/dates');
const { logActivity } = require('../services/activity.service');

async function ensureWeightTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS puppy_weights (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
      weight_date DATE NOT NULL,
      weight_grams INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_puppy_weights_breeder_puppy_date ON puppy_weights(breeder_id, puppy_id, weight_date DESC)');
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

exports.listWeights = async (req, res) => {
  try {
    await ensureWeightTables();
    const breederId = req.session.user.breeder_id;
    const puppyId = req.query.puppy_id || '';

    const puppies = await pool.query(`
      SELECT p.id, p.name, p.sex, p.status, p.chip_number, d.name AS mother_name, l.birth_date
      FROM puppies p
      LEFT JOIN litters l ON p.litter_id = l.id
      LEFT JOIN dogs d ON l.mother_id = d.id
      WHERE p.breeder_id = $1
      ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
    `, [breederId]);

    const selectedPuppy = puppyId ? puppies.rows.find((p) => String(p.id) === String(puppyId)) : puppies.rows[0];
    const selectedId = selectedPuppy?.id || null;

    const weights = selectedId
      ? await pool.query(`
          SELECT *
          FROM puppy_weights
          WHERE breeder_id = $1 AND puppy_id = $2
          ORDER BY weight_date ASC
        `, [breederId, selectedId])
      : { rows: [] };

    const last = weights.rows[weights.rows.length - 1] || null;
    const previous = weights.rows[weights.rows.length - 2] || null;
    const gain = last && previous ? last.weight_grams - previous.weight_grams : null;

    res.render('weights/index', {
      title: 'Suivi de poids',
      puppies: puppies.rows,
      selectedPuppy,
      weights: weights.rows,
      gain,
      chartLabels: weights.rows.map((w) => new Date(w.weight_date).toLocaleDateString('fr-FR')),
      chartValues: weights.rows.map((w) => w.weight_grams),
    });
  } catch (error) {
    console.error('Erreur suivi poids:', error);
    setFlash(req, 'error', 'Erreur lors du chargement du suivi de poids.');
    res.redirect('/dashboard');
  }
};

exports.addWeight = async (req, res) => {
  try {
    await ensureWeightTables();
    const breederId = req.session.user.breeder_id;
    const puppyId = req.body.puppy_id;
    const weightDate = assertIsoDate(req.body.weight_date, 'date de pesée');
    const weightGrams = Number.parseInt(req.body.weight_grams, 10);
    const notes = String(req.body.notes || '').trim() || null;

    if (!puppyId || !Number.isInteger(weightGrams) || weightGrams <= 0) {
      setFlash(req, 'error', 'Chiot, date et poids positif sont obligatoires.');
      return res.redirect('/weights');
    }

    const puppy = await pool.query(
      'SELECT id, name FROM puppies WHERE id = $1 AND breeder_id = $2',
      [puppyId, breederId],
    );

    if (!puppy.rows.length) {
      setFlash(req, 'error', 'Chiot introuvable pour cet élevage.');
      return res.redirect('/weights');
    }

    const duplicate = await pool.query(
      `SELECT id FROM puppy_weights
       WHERE breeder_id = $1 AND puppy_id = $2 AND weight_date = $3
       LIMIT 1`,
      [breederId, puppyId, weightDate],
    );

    if (duplicate.rows.length) {
      setFlash(req, 'warning', 'Une pesée existe déjà pour ce chiot à cette date. Aucun doublon n’a été créé.');
      return res.redirect(`/weights?puppy_id=${puppyId}`);
    }

    const inserted = await pool.query(`
      INSERT INTO puppy_weights (breeder_id, puppy_id, weight_date, weight_grams, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [breederId, puppyId, weightDate, weightGrams, notes]);

    await logActivity(pool, {
      breederId,
      userId: req.session.user.id,
      action: 'weight.created',
      entityType: 'puppy_weight',
      entityId: inserted.rows[0].id,
      label: `${puppy.rows[0].name || 'Chiot'} - ${weightGrams} g`,
      metadata: { puppyId, weightDate, weightGrams },
    });

    setFlash(req, 'success', 'Pesée enregistrée avec succès.');
    return res.redirect(`/weights?puppy_id=${puppyId}`);
  } catch (error) {
    console.error('Erreur ajout poids:', error);
    setFlash(req, 'error', error.message || 'Erreur lors de l’enregistrement du poids.');
    return res.redirect('/weights');
  }
};