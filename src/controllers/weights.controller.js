const { pool } = require('../db');

async function ensureWeightTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS puppy_weights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      puppy_id UUID NOT NULL REFERENCES puppies(id) ON DELETE CASCADE,
      weight_date DATE NOT NULL,
      weight_grams INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_puppy_weights_breeder_puppy_date ON puppy_weights(breeder_id, puppy_id, weight_date DESC)');
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
    res.status(500).send('Erreur lors du chargement du suivi de poids.');
  }
};

exports.addWeight = async (req, res) => {
  try {
    await ensureWeightTables();
    const breederId = req.session.user.breeder_id;
    const { puppy_id, weight_date, weight_grams, notes } = req.body;

    if (!puppy_id || !weight_date || !weight_grams) {
      return res.status(400).send('Chiot, date et poids obligatoires.');
    }

    await pool.query(`
      INSERT INTO puppy_weights (breeder_id, puppy_id, weight_date, weight_grams, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [breederId, puppy_id, weight_date, Number(weight_grams), notes || null]);

    res.redirect(`/weights?puppy_id=${puppy_id}`);
  } catch (error) {
    console.error('Erreur ajout poids:', error);
    res.status(500).send('Erreur lors de l’enregistrement du poids.');
  }
};
