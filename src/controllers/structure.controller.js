const { pool } = require('../db');

const STRUCTURE_VISUALS = {
  kennel: {
    aliases: ['kennel', 'box', 'chenil'],
    icon: 'warehouse',
    imageUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1600&q=82',
    description: 'Zone d’hébergement et de repos des chiens adultes.',
    label: 'Zone chenil',
  },
  nursery: {
    aliases: ['nursery', 'nurserie', 'maternite', 'maternité', 'mise bas'],
    icon: 'child_care',
    imageUrl: 'https://images.unsplash.com/photo-1593134257782-e89567b7718a?auto=format&fit=crop&w=1600&q=82',
    description: 'Espace maternité, mise bas et premiers jours des chiots.',
    label: 'Zone maternité',
  },
  infirmary: {
    aliases: ['infirmary', 'infirmerie', 'soin', 'soins', 'medical', 'médical', 'quarantaine'],
    icon: 'medical_services',
    imageUrl: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=1600&q=82',
    description: 'Zone soins, isolement, observation et hygiène sanitaire.',
    label: 'Zone sanitaire',
  },
  yard: {
    aliases: ['yard', 'parc', 'terrain', 'exterieur', 'extérieur', 'ebats', 'ébats', 'agility'],
    icon: 'park',
    imageUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82',
    description: 'Aire extérieure de détente, activité et socialisation.',
    label: 'Zone extérieure',
  },
  other: {
    aliases: ['other', 'autre', 'garage', 'stockage'],
    icon: 'domain',
    imageUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82',
    description: 'Infrastructure opérationnelle de l’élevage.',
    label: 'Zone principale',
  },
};

const DEFAULT_INFRASTRUCTURES = [
  {
    name: 'Chenils / Box',
    type: 'box',
    description: STRUCTURE_VISUALS.kennel.description,
    capacity: 16,
    status: 'actif',
    image_url: STRUCTURE_VISUALS.kennel.imageUrl,
    zone_label: STRUCTURE_VISUALS.kennel.label,
  },
  {
    name: 'Nurserie',
    type: 'nurserie',
    description: STRUCTURE_VISUALS.nursery.description,
    capacity: 5,
    status: 'actif',
    image_url: STRUCTURE_VISUALS.nursery.imageUrl,
    zone_label: STRUCTURE_VISUALS.nursery.label,
  },
  {
    name: 'Infirmerie',
    type: 'infirmerie',
    description: STRUCTURE_VISUALS.infirmary.description,
    capacity: 2,
    status: 'attention',
    image_url: STRUCTURE_VISUALS.infirmary.imageUrl,
    zone_label: STRUCTURE_VISUALS.infirmary.label,
  },
  {
    name: "Parcs d'ébats",
    type: 'parc',
    description: STRUCTURE_VISUALS.yard.description,
    capacity: 3,
    status: 'libre',
    image_url: STRUCTURE_VISUALS.yard.imageUrl,
    zone_label: STRUCTURE_VISUALS.yard.label,
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

function toSearchable(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getStructureVisual(item = {}) {
  const haystack = `${toSearchable(item.type)} ${toSearchable(item.name)} ${toSearchable(item.description)}`;
  const entry = Object.values(STRUCTURE_VISUALS).find((visual) => visual.aliases.some((alias) => haystack.includes(toSearchable(alias))));
  return entry || STRUCTURE_VISUALS.other;
}

function normalizeStatus(status, occupied, capacity) {
  const raw = toSearchable(status);
  if (raw.includes('maintenance')) return 'Maintenance';
  if (raw.includes('attention') || raw.includes('observation')) return 'Attention';
  if (raw.includes('libre')) return 'Libre';
  if (raw.includes('complet')) return 'Complet';
  if (raw.includes('actif') || raw.includes('active')) return 'Actif';
  if (!capacity) return 'Libre';
  if (occupied >= capacity) return 'Complet';
  if (occupied / capacity >= 0.8) return 'Attention';
  if (occupied > 0) return 'Actif';
  return 'Libre';
}

function slugClass(value) {
  return toSearchable(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'actif';
}

async function seedDefaultInfrastructures(breederId) {
  const existing = await pool.query('SELECT COUNT(*)::int AS total FROM infrastructures WHERE breeder_id = $1', [breederId]);
  if ((existing.rows[0]?.total || 0) > 0) return;

  for (const item of DEFAULT_INFRASTRUCTURES) {
    await pool.query(
      `
        INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url, zone_label)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [breederId, item.name, item.type, item.description, item.capacity, item.status, item.image_url, item.zone_label],
    );
  }
}

async function backfillInfrastructurePresentation(breederId) {
  const result = await pool.query(
    'SELECT id, name, type, description, image_url, zone_label FROM infrastructures WHERE breeder_id = $1',
    [breederId],
  );

  for (const item of result.rows) {
    const visual = getStructureVisual(item);
    const nextDescription = item.description && String(item.description).trim() ? item.description : visual.description;
    const nextImageUrl = item.image_url && String(item.image_url).trim() ? item.image_url : visual.imageUrl;
    const nextZoneLabel = item.zone_label && String(item.zone_label).trim() ? item.zone_label : visual.label;

    if (nextDescription !== item.description || nextImageUrl !== item.image_url || nextZoneLabel !== item.zone_label) {
      await pool.query(
        `
          UPDATE infrastructures
          SET description = $1,
              image_url = $2,
              zone_label = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND breeder_id = $5
        `,
        [nextDescription, nextImageUrl, nextZoneLabel, item.id, breederId],
      ).catch(() => {});
    }
  }
}

async function safeCount(query, params = []) {
  const result = await pool.query(query, params).catch(() => ({ rows: [{ total: 0 }] }));
  return Number(result.rows[0]?.total || 0);
}

function buildSanitaryCompliance({ sanitaryCount, cleaningCount, movementCount }) {
  const criteria = [
    { key: 'sanitary', label: 'registre sanitaire', ok: sanitaryCount > 0 },
    { key: 'cleaning', label: 'journal de nettoyage / désinfection', ok: cleaningCount > 0 },
    { key: 'movements', label: 'registre des entrées et sorties', ok: movementCount > 0 },
  ];
  const completed = criteria.filter((item) => item.ok).length;
  const score = Math.round((completed / criteria.length) * 100);
  const missing = criteria.filter((item) => !item.ok).map((item) => item.label);

  let message = 'Tous les registres réglementaires sont alimentés.';
  if (score === 0) message = 'Aucune donnée réglementaire saisie : le suivi DDPP est à initialiser.';
  else if (score < 100) message = 'Suivi réglementaire partiel : des registres restent à compléter.';

  return { score, missing, message };
}

exports.index = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    await seedDefaultInfrastructures(breederId);
    await backfillInfrastructurePresentation(breederId);

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
          CASE
            WHEN lower(COALESCE(i.type, '')) IN ('kennel', 'box', 'chenil') THEN 1
            WHEN lower(COALESCE(i.type, '')) IN ('nursery', 'nurserie') THEN 2
            WHEN lower(COALESCE(i.type, '')) IN ('infirmary', 'infirmerie') THEN 3
            WHEN lower(COALESCE(i.type, '')) IN ('yard', 'parc') THEN 4
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

    const sanitaryCount = await safeCount('SELECT COUNT(*)::int AS total FROM sanitary_records WHERE breeder_id = $1', [breederId]);
    const cleaningCount = await safeCount('SELECT COUNT(*)::int AS total FROM cleaning_logs WHERE breeder_id = $1', [breederId]);
    const movementCount = await safeCount('SELECT COUNT(*)::int AS total FROM movements WHERE breeder_id = $1', [breederId]);
    const sanitaryCompliance = buildSanitaryCompliance({ sanitaryCount, cleaningCount, movementCount });

    const infrastructures = infrastructuresResult.rows.map((item) => {
      const occupied = Number(item.computed_occupied || item.occupied_count || 0);
      const capacity = Number(item.capacity || 0);
      const visual = getStructureVisual(item);
      const displayStatus = normalizeStatus(item.status, occupied, capacity);
      return {
        ...item,
        occupied,
        capacity,
        icon: visual.icon,
        cardImageUrl: item.image_url || visual.imageUrl,
        description: item.description || visual.description,
        zone_label: item.zone_label || visual.label,
        occupancyRate: capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0,
        displayStatus,
        statusClass: slugClass(displayStatus),
      };
    });

    const totalCapacity = infrastructures.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
    const totalOccupied = infrastructures.reduce((sum, item) => sum + Number(item.occupied || 0), 0);

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
        sanitaryScore: sanitaryCompliance.score,
        sanitaryMissing: sanitaryCompliance.missing,
        sanitaryMessage: sanitaryCompliance.message,
        sanitaryCounts: { sanitaryCount, cleaningCount, movementCount },
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
    const visual = getStructureVisual({ name, type, description });

    await pool.query(
      `
        INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url, zone_label)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        breederId,
        name,
        type || 'box',
        description || visual.description,
        Number(capacity || 0),
        status || 'actif',
        image_url || visual.imageUrl,
        visual.label,
      ],
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