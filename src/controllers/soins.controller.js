const { pool } = require('../db');

async function ensureHealthAnimalColumns() {
  await pool.query('ALTER TABLE soins ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE');
  await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS soin_id UUID REFERENCES soins(id) ON DELETE CASCADE');
}

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function getLitterMotherColumn() {
  if (await columnExists('litters', 'mother_id')) return 'mother_id';
  if (await columnExists('litters', 'female_id')) return 'female_id';
  return null;
}

function parseAnimalSelection(body) {
  let dogId = null;
  let puppyId = null;
  if (body.animal_selection) {
    const [animalType, animalId] = String(body.animal_selection).split('|');
    if (animalType === 'dog') dogId = animalId || null;
    if (animalType === 'puppy') puppyId = animalId || null;
  } else if (body.dog_id) {
    dogId = body.dog_id;
  }
  return { dogId, puppyId };
}

function cleanDate(value) {
  return value && String(value).trim() !== '' ? value : null;
}

async function getAnimalName(client, breederId, dogId, puppyId) {
  if (dogId) {
    const result = await client.query('SELECT name FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
    return result.rows[0]?.name || null;
  }
  if (puppyId) {
    const result = await client.query('SELECT name FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
    return result.rows[0]?.name || null;
  }
  return null;
}

function reminderTitle(label, type, animalName) {
  return animalName ? `Rappel : ${label} (${type}) - ${animalName}` : `Rappel : ${label} (${type})`;
}

async function removeLinkedReminder(client, breederId, soin) {
  if (!soin) return;
  await client.query(
    `DELETE FROM reminders
     WHERE breeder_id = $1
       AND (
         soin_id = $2
         OR (
           dog_id IS NOT DISTINCT FROM $3
           AND puppy_id IS NOT DISTINCT FROM $4
           AND type IS NOT DISTINCT FROM $5
           AND due_date IS NOT DISTINCT FROM $6
           AND title LIKE $7
         )
       )`,
    [breederId, soin.id, soin.dog_id, soin.puppy_id, soin.type, soin.next_due, `Rappel : ${soin.label} (${soin.type})%`],
  );
}

async function createLinkedReminder(client, { breederId, soinId, dogId, puppyId, type, label, nextDue, animalName }) {
  if (!nextDue) return;
  await client.query(
    `INSERT INTO reminders (breeder_id, dog_id, puppy_id, soin_id, type, title, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [breederId, dogId, puppyId, soinId, type, reminderTitle(label, type, animalName), nextDue],
  );
}

async function loadAnimals(breederId) {
  const dogs = await pool.query(
    `SELECT id, name, chip_number, status
     FROM dogs
     WHERE breeder_id = $1
       AND COALESCE(lower(status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee', 'archivé', 'archive')
     ORDER BY name ASC`,
    [breederId],
  );

  const motherColumn = await getLitterMotherColumn();
  const motherJoin = motherColumn ? `LEFT JOIN dogs d ON l.${motherColumn} = d.id` : 'LEFT JOIN dogs d ON false';
  const puppies = await pool.query(
    `SELECT p.id, p.name, p.chip_number, p.status, l.birth_date AS litter_birth_date, d.name AS mother_name
     FROM puppies p
     LEFT JOIN litters l ON p.litter_id = l.id
     ${motherJoin}
     WHERE p.breeder_id = $1
       AND COALESCE(lower(p.status), '') NOT IN ('vendu', 'vendue', 'décédé', 'decede', 'décédée', 'decedee')
     ORDER BY l.birth_date DESC NULLS LAST, p.name ASC NULLS LAST`,
    [breederId],
  );

  return { dogs: dogs.rows, puppies: puppies.rows };
}

async function loadSoins(breederId) {
  const result = await pool.query(
    `SELECT s.id, s.dog_id, s.puppy_id, s.type, s.label, s.event_date, s.next_due, s.notes,
            COALESCE(d.name, p.name) AS animal_name,
            CASE WHEN s.puppy_id IS NOT NULL THEN 'Chiot'
                 WHEN s.dog_id IS NOT NULL THEN 'Chien adulte'
                 ELSE 'Général'
            END AS animal_category
     FROM soins s
     LEFT JOIN dogs d ON s.dog_id = d.id
     LEFT JOIN puppies p ON s.puppy_id = p.id
     WHERE s.breeder_id = $1
     ORDER BY s.event_date DESC NULLS LAST`,
    [breederId],
  );
  return result.rows;
}

async function renderIndex(req, res, editingSoin = null) {
  await ensureHealthAnimalColumns();
  const breederId = req.session.user.breeder_id;
  const animals = await loadAnimals(breederId);
  const soins = await loadSoins(breederId);
  return res.render('soins/index', {
    soins,
    dogs: animals.dogs,
    puppies: animals.puppies,
    editingSoin,
    user: req.session.user,
  });
}

exports.listSoins = async (req, res) => {
  try {
    return renderIndex(req, res);
  } catch (error) {
    console.error('Erreur liste soins:', error);
    return res.status(500).send('Erreur lors de la récupération du registre de santé.');
  }
};

exports.editSoin = async (req, res) => {
  try {
    await ensureHealthAnimalColumns();
    const breederId = req.session.user.breeder_id;
    const result = await pool.query(
      `SELECT id, dog_id, puppy_id, type, label, event_date, next_due, notes
       FROM soins
       WHERE id = $1 AND breeder_id = $2`,
      [req.params.id, breederId],
    );
    if (result.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
        user: req.session?.user || null,
      });
    }
    return renderIndex(req, res, result.rows[0]);
  } catch (error) {
    console.error('Erreur édition soin:', error);
    return res.status(500).send('Erreur lors du chargement du soin.');
  }
};

exports.createSoin = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHealthAnimalColumns();
    const breederId = req.session.user.breeder_id;
    const { type, label, event_date, notes } = req.body;
    const nextDue = cleanDate(req.body.next_due);
    const { dogId, puppyId } = parseAnimalSelection(req.body);
    const animalName = await getAnimalName(client, breederId, dogId, puppyId);

    await client.query('BEGIN');
    const soin = await client.query(
      `INSERT INTO soins (breeder_id, dog_id, puppy_id, type, label, event_date, next_due, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [breederId, dogId, puppyId, type, label, event_date, nextDue, notes],
    );
    await createLinkedReminder(client, { breederId, soinId: soin.rows[0].id, dogId, puppyId, type, label, nextDue, animalName });
    await client.query('COMMIT');
    return res.redirect('/soins');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création soin:', error);
    return res.status(500).send('Erreur lors de l\'enregistrement du soin.');
  } finally {
    client.release();
  }
};

exports.updateSoin = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHealthAnimalColumns();
    const breederId = req.session.user.breeder_id;
    const soinId = req.params.id;
    const { type, label, event_date, notes } = req.body;
    const nextDue = cleanDate(req.body.next_due);
    const { dogId, puppyId } = parseAnimalSelection(req.body);
    const animalName = await getAnimalName(client, breederId, dogId, puppyId);

    const previous = await client.query(
      `SELECT id, dog_id, puppy_id, type, label, next_due
       FROM soins
       WHERE id = $1 AND breeder_id = $2`,
      [soinId, breederId],
    );
    if (previous.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
        user: req.session?.user || null,
      });
    }

    await client.query('BEGIN');
    await removeLinkedReminder(client, breederId, previous.rows[0]);
    await client.query(
      `UPDATE soins
       SET dog_id = $1, puppy_id = $2, type = $3, label = $4, event_date = $5, next_due = $6, notes = $7
       WHERE id = $8 AND breeder_id = $9`,
      [dogId, puppyId, type, label, event_date, nextDue, notes, soinId, breederId],
    );
    await createLinkedReminder(client, { breederId, soinId, dogId, puppyId, type, label, nextDue, animalName });
    await client.query('COMMIT');
    return res.redirect('/soins');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur modification soin:', error);
    return res.status(500).send('Erreur lors de la modification du soin.');
  } finally {
    client.release();
  }
};

exports.deleteSoin = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHealthAnimalColumns();
    const breederId = req.session.user.breeder_id;
    const soinId = req.params.id;
    const previous = await client.query(
      `SELECT id, dog_id, puppy_id, type, label, next_due
       FROM soins
       WHERE id = $1 AND breeder_id = $2`,
      [soinId, breederId],
    );
    await client.query('BEGIN');
    if (previous.rows.length > 0) await removeLinkedReminder(client, breederId, previous.rows[0]);
    await client.query('DELETE FROM soins WHERE id = $1 AND breeder_id = $2', [soinId, breederId]);
    await client.query('COMMIT');
    return res.redirect('/soins');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur suppression soin:', error);
    return res.status(500).send('Erreur lors de la suppression du soin.');
  } finally {
    client.release();
  }
};
