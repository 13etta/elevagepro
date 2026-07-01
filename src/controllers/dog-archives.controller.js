const { pool } = require('../db');

function clean(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function safeRows(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (['42P01', '42703'].includes(error?.code)) return [];
    throw error;
  }
}

async function safeCount(query, params = []) {
  const rows = await safeRows(query, params);
  return Number(rows[0]?.total || 0);
}

async function columnExists(tableName, columnName) {
  const rows = await safeRows(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return Boolean(rows[0]?.exists);
}

async function getLitterMotherColumn() {
  if (await columnExists('litters', 'mother_id')) return 'mother_id';
  if (await columnExists('litters', 'female_id')) return 'female_id';
  return null;
}

async function enrichArchivedDog(dog, breederId) {
  const dogId = dog.id;
  const [soins, reminders, tests, heats, matings, pregnancies, litters] = await Promise.all([
    safeCount('SELECT COUNT(*)::int AS total FROM soins WHERE breeder_id = $1 AND dog_id = $2', [breederId, dogId]),
    safeCount('SELECT COUNT(*)::int AS total FROM reminders WHERE breeder_id = $1 AND dog_id = $2', [breederId, dogId]),
    safeCount('SELECT COUNT(*)::int AS total FROM health_tests WHERE breeder_id = $1 AND dog_id = $2', [breederId, dogId]),
    safeCount('SELECT COUNT(*)::int AS total FROM heats WHERE breeder_id = $1 AND dog_id = $2', [breederId, dogId]),
    safeCount('SELECT COUNT(*)::int AS total FROM matings WHERE breeder_id = $1 AND (male_id = $2 OR female_id = $2)', [breederId, dogId]),
    safeCount('SELECT COUNT(*)::int AS total FROM pregnancies WHERE breeder_id = $1 AND female_id = $2', [breederId, dogId]),
    (async () => {
      const motherColumn = await getLitterMotherColumn();
      if (!motherColumn) return 0;
      return safeCount(`SELECT COUNT(*)::int AS total FROM litters WHERE breeder_id = $1 AND ${motherColumn} = $2`, [breederId, dogId]);
    })(),
  ]);

  const movements = await safeRows(
    `SELECT movement_date, reason, notes
     FROM dog_movements
     WHERE breeder_id::text = $1::text
       AND dog_id::text = $2::text
       AND movement_type = 'SORTIE'
     ORDER BY movement_date DESC, created_at DESC
     LIMIT 1`,
    [breederId, dogId],
  );

  return {
    ...dog,
    exit: movements[0] || null,
    archive_count: soins + reminders + tests + heats + matings + pregnancies + litters,
  };
}

exports.listArchives = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const q = clean(req.query.q);
    const values = [breederId];
    let searchClause = '';

    if (q) {
      values.push(`%${q}%`);
      searchClause = `AND (
        d.name ILIKE $${values.length}
        OR COALESCE(d.chip_number, '') ILIKE $${values.length}
        OR COALESCE(d.id_scc, '') ILIKE $${values.length}
        OR COALESCE(d.breed, '') ILIKE $${values.length}
      )`;
    }

    const dogs = await safeRows(
      `SELECT d.*
       FROM dogs d
       WHERE d.breeder_id = $1
         AND LOWER(COALESCE(d.status, 'actif')) = 'sorti'
         ${searchClause}
       ORDER BY d.updated_at DESC NULLS LAST, d.name ASC`,
      values,
    );

    const archives = await Promise.all(dogs.map((dog) => enrichArchivedDog(dog, breederId)));

    return res.render('dogs/archives/index', {
      title: 'Archives chiens',
      archives,
      q: q || '',
    });
  } catch (error) {
    console.error('Erreur liste archives chiens:', error);
    return res.status(500).send('Erreur lors du chargement des archives chiens.');
  }
};

exports.showArchive = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const dogId = req.params.id;

    const dogs = await safeRows(
      `SELECT d.*, father.name AS father_name, mother.name AS mother_name
       FROM dogs d
       LEFT JOIN dogs father ON father.id = d.father_id
       LEFT JOIN dogs mother ON mother.id = d.mother_id
       WHERE d.id = $1
         AND d.breeder_id = $2
         AND LOWER(COALESCE(d.status, 'actif')) = 'sorti'`,
      [dogId, breederId],
    );

    if (!dogs.length) {
      return res.status(404).render('errors/404', {
        title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
        user: req.session?.user || null,
      });
    }

    const dog = dogs[0];
    const litterMotherColumn = await getLitterMotherColumn();

    const [movements, soins, reminders, tests, heats, matings, pregnancies, litters, puppies, assignments] = await Promise.all([
      safeRows(
        `SELECT *
         FROM dog_movements
         WHERE breeder_id::text = $1::text AND dog_id::text = $2::text
         ORDER BY movement_date DESC, created_at DESC`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT id, type, label, event_date, next_due, notes
         FROM soins
         WHERE breeder_id = $1 AND dog_id = $2
         ORDER BY event_date DESC NULLS LAST, created_at DESC NULLS LAST`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT id, title, due_date, type, notes, is_completed
         FROM reminders
         WHERE breeder_id = $1 AND dog_id = $2
         ORDER BY due_date DESC NULLS LAST, created_at DESC`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT id, test_type, test_name, result, test_date, laboratory, certificate_url, notes
         FROM health_tests
         WHERE breeder_id = $1 AND dog_id = $2
         ORDER BY test_date DESC NULLS LAST, created_at DESC`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT id, start_date, end_date, stage, notes
         FROM heats
         WHERE breeder_id = $1 AND dog_id = $2
         ORDER BY start_date DESC`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT m.*, male.name AS male_name, female.name AS female_name
         FROM matings m
         LEFT JOIN dogs male ON male.id = m.male_id
         LEFT JOIN dogs female ON female.id = m.female_id
         WHERE m.breeder_id = $1 AND (m.male_id = $2 OR m.female_id = $2)
         ORDER BY m.mating_date DESC`,
        [breederId, dogId],
      ),
      safeRows(
        `SELECT p.*, male.name AS father_name
         FROM pregnancies p
         LEFT JOIN matings m ON m.id = p.mating_id
         LEFT JOIN dogs male ON male.id = m.male_id
         WHERE p.breeder_id = $1 AND p.female_id = $2
         ORDER BY p.start_date DESC`,
        [breederId, dogId],
      ),
      litterMotherColumn
        ? safeRows(
          `SELECT l.*, male.name AS father_name
           FROM litters l
           LEFT JOIN matings m ON m.id = l.mating_id
           LEFT JOIN dogs male ON male.id = m.male_id
           WHERE l.breeder_id = $1 AND l.${litterMotherColumn} = $2
           ORDER BY l.birth_date DESC`,
          [breederId, dogId],
        )
        : Promise.resolve([]),
      litterMotherColumn
        ? safeRows(
          `SELECT p.*
           FROM puppies p
           INNER JOIN litters l ON l.id = p.litter_id
           WHERE p.breeder_id = $1 AND l.${litterMotherColumn} = $2
           ORDER BY p.birth_date DESC NULLS LAST, p.created_at DESC NULLS LAST`,
          [breederId, dogId],
        )
        : Promise.resolve([]),
      safeRows(
        `SELECT ia.*, i.name AS infrastructure_name, previous.name AS previous_infrastructure_name
         FROM infrastructure_assignments ia
         LEFT JOIN infrastructures i ON i.id = ia.infrastructure_id
         LEFT JOIN infrastructures previous ON previous.id = ia.previous_infrastructure_id
         WHERE ia.breeder_id = $1 AND ia.dog_id = $2
         ORDER BY ia.assigned_at DESC, ia.created_at DESC`,
        [breederId, dogId],
      ),
    ]);

    return res.render('dogs/archives/show', {
      title: `Archive de ${dog.name}`,
      dog,
      movements,
      soins,
      reminders,
      tests,
      heats,
      matings,
      pregnancies,
      litters,
      puppies,
      assignments,
      exitMovement: movements.find((movement) => movement.movement_type === 'SORTIE') || null,
    });
  } catch (error) {
    console.error('Erreur archive chien:', error);
    return res.status(500).send('Erreur lors du chargement du dossier archivé.');
  }
};
