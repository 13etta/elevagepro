const { pool } = require('../db');

const DEFAULT_INFRASTRUCTURES = [
  {
    name: 'Chenils / Box',
    type: 'kennel',
    description: "Principal bâtiment d'hébergement",
    capacity: 16,
    status: 'Actif',
    image_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Nurserie',
    type: 'nursery',
    description: 'Maternité et espace chiots',
    capacity: 5,
    status: 'Actif',
    image_url: 'https://images.unsplash.com/photo-1593134257782-e89567b7718a?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: 'Infirmerie',
    type: 'infirmary',
    description: 'Espace soins et quarantaine',
    capacity: 2,
    status: 'Attention',
    image_url: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=1400&q=80',
  },
  {
    name: "Parcs d'ébats",
    type: 'yard',
    description: 'Aires de détente extérieures',
    capacity: 3,
    status: 'Libre',
    image_url: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1400&q=80',
  },
];

async function ensureStructureSchema() {
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS description TEXT').catch(() => {});
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS image_url TEXT').catch(() => {});
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS zone_label VARCHAR(120)').catch(() => {});
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS occupied_count INTEGER DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP').catch(() => {});
  await pool.query('ALTER TABLE dogs ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER').catch(() => {});
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER').catch(() => {});
}

async function seedDefaultInfrastructures(breederId) {
  const existing = await pool.query('SELECT COUNT(*)::int AS total FROM infrastructures WHERE breeder_id = $1', [breederId]);
  if ((existing.rows[0]?.total || 0) > 0) return;

  for (const item of DEFAULT_INFRASTRUCTURES) {
    await pool.query(
      `
        INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [breederId, item.name, item.type, item.description, item.capacity, item.status, item.image_url],
    );
  }
}

function normalizeStatus(status, occupied, capacity) {
  if (status) return status;
  if (!capacity) return 'Libre';
  if (occupied >= capacity) return 'Complet';
  if (occupied / capacity >= 0.8) return 'Attention';
  if (occupied > 0) return 'Actif';
  return 'Libre';
}

exports.index = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    await seedDefaultInfrastructures(breederId);

    const infrastructuresResult = await pool.query(
      `
        SELECT
          i.*,
          COALESCE(dogs_count.total, 0) + COALESCE(puppies_count.total, 0) AS computed_occupied
        FROM infrastructures i
        LEFT JOIN (
          SELECT infrastructure_id, COUNT(*)::int AS total
          FROM dogs
          WHERE breeder_id = $1 AND infrastructure_id IS NOT NULL
          GROUP BY infrastructure_id
        ) dogs_count ON dogs_count.infrastructure_id = i.id
        LEFT JOIN (
          SELECT infrastructure_id, COUNT(*)::int AS total
          FROM puppies
          WHERE breeder_id = $1 AND infrastructure_id IS NOT NULL AND COALESCE(is_sold, false) = false
          GROUP BY infrastructure_id
        ) puppies_count ON puppies_count.infrastructure_id = i.id
        WHERE i.breeder_id = $1
        ORDER BY
          CASE i.type
            WHEN 'kennel' THEN 1
            WHEN 'nursery' THEN 2
            WHEN 'infirmary' THEN 3
            WHEN 'yard' THEN 4
            ELSE 10
          END,
          i.name ASC
      `,
      [breederId],
    );

    const staff = await pool.query(
      `
        SELECT *
        FROM staff
        WHERE breeder_id = $1
        ORDER BY status ASC NULLS LAST, role ASC NULLS LAST, last_name ASC NULLS LAST
        LIMIT 8
      `,
      [breederId],
    ).catch(() => ({ rows: [] }));

    const movements = await pool.query(
      `
        SELECT *
        FROM movements
        WHERE breeder_id = $1
        ORDER BY movement_date DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 3
      `,
      [breederId],
    ).catch(() => ({ rows: [] }));

    const sanitary = await pool.query(
      `
        SELECT *
        FROM sanitary_records
        WHERE breeder_id = $1
        ORDER BY event_date DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 3
      `,
      [breederId],
    ).catch(() => ({ rows: [] }));

    const cleaning = await pool.query(
      `
        SELECT *
        FROM cleaning_logs
        WHERE breeder_id = $1
        ORDER BY cleaning_date DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 3
      `,
      [breederId],
    ).catch(() => ({ rows: [] }));

    const infrastructures = infrastructuresResult.rows.map((item) => {
      const occupied = Number(item.computed_occupied || item.occupied_count || 0);
      const capacity = Number(item.capacity || 0);
      return {
        ...item,
        occupied,
        capacity,
        occupancyRate: capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0,
        displayStatus: normalizeStatus(item.status, occupied, capacity),
      };
    });

    const totalCapacity = infrastructures.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
    const totalOccupied = infrastructures.reduce((sum, item) => sum + Number(item.occupied || 0), 0);
    const sanitaryScore = sanitary.rows.length ? 100 : 100;

    res.render('structure/index', {
      title: 'Gestion de la structure',
      infrastructures,
      staff: staff.rows,
      movements: movements.rows,
      sanitary: sanitary.rows,
      cleaning: cleaning.rows,
      stats: {
        totalCapacity,
        totalOccupied,
        sanitaryScore,
      },
    });
  } catch (error) {
    console.error('Erreur structure:', error);
    res.status(500).send('Erreur lors du chargement de la gestion de structure.');
  }
};

exports.storeInfrastructure = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    const { name, type, description, capacity, status, image_url } = req.body;

    await pool.query(
      `
        INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [breederId, name, type || 'kennel', description || '', Number(capacity || 0), status || 'Actif', image_url || null],
    );

    res.redirect('/structure');
  } catch (error) {
    console.error('Erreur création infrastructure:', error);
    res.status(500).send('Erreur lors de la création du bâtiment.');
  }
};

exports.assignInfrastructure = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    const { infrastructure_id, dog_id, puppy_id } = req.body;

    if (dog_id) {
      await pool.query('UPDATE dogs SET infrastructure_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND breeder_id = $3', [infrastructure_id || null, dog_id, breederId]);
    }
    if (puppy_id) {
      await pool.query('UPDATE puppies SET infrastructure_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND breeder_id = $3', [infrastructure_id || null, puppy_id, breederId]);
    }

    res.redirect('/structure');
  } catch (error) {
    console.error('Erreur assignation infrastructure:', error);
    res.status(500).send("Erreur lors de l'assignation.");
  }
};
