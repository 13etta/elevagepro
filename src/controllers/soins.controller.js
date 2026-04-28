const { pool } = require('../db');

async function ensureHealthAnimalColumns() {
  await pool.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
}

exports.listSoins = async (req, res) => {
  try {
    await ensureHealthAnimalColumns();

    const breederId = req.session.user.breeder_id;

    const result = await pool.query(
      `
        SELECT
          s.id,
          s.type,
          s.label,
          s.event_date,
          s.next_due,
          COALESCE(d.name, p.name) AS animal_name,
          CASE
            WHEN s.puppy_id IS NOT NULL THEN 'Chiot'
            WHEN s.dog_id IS NOT NULL THEN 'Chien adulte'
            ELSE 'Général'
          END AS animal_category
        FROM soins s
        LEFT JOIN dogs d ON s.dog_id = d.id
        LEFT JOIN puppies p ON s.puppy_id = p.id
        WHERE s.breeder_id = $1
        ORDER BY s.event_date DESC
      `,
      [breederId],
    );

    const dogsResult = await pool.query(
      `
        SELECT id, name, chip_number, status
        FROM dogs
        WHERE breeder_id = $1
          AND COALESCE(lower(status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee', 'archivé', 'archive')
        ORDER BY name ASC
      `,
      [breederId],
    );

    const puppiesResult = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.chip_number,
          p.status,
          l.birth_date AS litter_birth_date,
          d.name AS mother_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs d ON l.mother_id = d.id
        WHERE p.breeder_id = $1
          AND COALESCE(lower(p.status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee')
        ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST
      `,
      [breederId],
    );

    res.render('soins/index', {
      soins: result.rows,
      dogs: dogsResult.rows,
      puppies: puppiesResult.rows,
      user: req.session.user,
    });
  } catch (error) {
    console.error('Erreur liste soins:', error);
    res.status(500).send('Erreur lors de la récupération du registre de santé.');
  }
};

exports.createSoin = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHealthAnimalColumns();

    const breederId = req.session.user.breeder_id;
    const { animal_selection, dog_id, type, label, event_date, next_due, notes } = req.body;

    let dogId = null;
    let puppyId = null;
    let animalName = null;

    if (animal_selection) {
      const [animalType, animalId] = animal_selection.split('|');
      if (animalType === 'dog') dogId = animalId;
      if (animalType === 'puppy') puppyId = animalId;
    } else if (dog_id) {
      dogId = dog_id;
    }

    if (dogId) {
      const dogRes = await client.query('SELECT name FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
      animalName = dogRes.rows[0]?.name || null;
    }

    if (puppyId) {
      const puppyRes = await client.query('SELECT name FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
      animalName = puppyRes.rows[0]?.name || null;
    }

    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO soins (breeder_id, dog_id, puppy_id, type, label, event_date, next_due, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [breederId, dogId, puppyId, type, label, event_date, next_due || null, notes],
    );

    if (next_due) {
      const reminderTitle = animalName
        ? `Rappel : ${label} (${type}) - ${animalName}`
        : `Rappel : ${label} (${type})`;

      await client.query(
        `
          INSERT INTO reminders (breeder_id, dog_id, puppy_id, type, title, due_date)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [breederId, dogId, puppyId, type, reminderTitle, next_due],
      );
    }

    await client.query('COMMIT');
    res.redirect('/soins');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création soin:', error);
    res.status(500).send('Erreur lors de l\'enregistrement du soin.');
  } finally {
    client.release();
  }
};
