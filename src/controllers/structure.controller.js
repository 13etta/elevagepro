const { pool } = require('../db');

const VISUALS = {
  box: {
    icon: 'warehouse',
    label: 'Zone chenil',
    imageUrl: 'https://i.postimg.cc/50PHnQXw/Chat-GPT-Image-20-mai-2026-14-52-33.png',
    description: 'Zone d’hébergement et de repos des chiens adultes.'
  },
  nurserie: {
    icon: 'child_care',
    label: 'Zone maternité',
    imageUrl: 'https://www.loyatdesdunes.fr/oktThemes/ra145-s/images/integration/elevage/el1.jpg',
    description: 'Espace maternité, mise bas et premiers jours des chiots.'
  },
  infirmerie: {
    icon: 'medical_services',
    label: 'Zone sanitaire',
    imageUrl: 'https://i.postimg.cc/JnTyPHsz/Chat-GPT-Image-20-mai-2026-14-58-13.png',
    description: 'Zone soins, isolement, observation et hygiène sanitaire.'
  },
  parc: {
    icon: 'park',
    label: 'Zone extérieure',
    imageUrl: 'https://www.epagneul-breton.ws/wp-content/uploads/2021/08/Activites-epagneul-breton-1024x683.jpeg',
    description: 'Aire extérieure de détente, activité et socialisation.'
  },
  autre: {
    icon: 'domain',
    label: 'Zone principale',
    imageUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=82',
    description: 'Infrastructure opérationnelle de l’élevage.'
  },
};

const DEFAULT_INFRASTRUCTURES = [
  { name: 'Chenils / Box', type: 'box', capacity: 16, status: 'actif' },
  { name: 'Nurserie', type: 'nurserie', capacity: 5, status: 'actif' },
  { name: 'Infirmerie / Quarantaine', type: 'infirmerie', capacity: 2, status: 'attention' },
  { name: "Parcs d'ébats", type: 'parc', capacity: 3, status: 'libre' },
];

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function clean(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseNullableInteger(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function visualFor(item = {}) {
  const haystack = `${normalize(item.type)} ${normalize(item.name)} ${normalize(item.description)}`;
  if (haystack.includes('nurserie') || haystack.includes('maternite') || haystack.includes('mise bas')) return VISUALS.nurserie;
  if (haystack.includes('infirmerie') || haystack.includes('quarantaine') || haystack.includes('soin')) return VISUALS.infirmerie;
  if (haystack.includes('parc') || haystack.includes('exterieur') || haystack.includes('ebats')) return VISUALS.parc;
  if (haystack.includes('box') || haystack.includes('chenil') || haystack.includes('kennel')) return VISUALS.box;
  return VISUALS.autre;
}

function displayStatus(status, occupied, capacity) {
  const raw = normalize(status);
  if (raw.includes('maintenance')) return 'Maintenance';
  if (raw.includes('attention')) return 'Attention';
  if (raw.includes('libre')) return 'Libre';
  if (capacity > 0 && occupied >= capacity) return 'Complet';
  if (occupied > 0) return 'Actif';
  return raw.includes('actif') ? 'Actif' : 'Libre';
}

function slugClass(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'actif';
}

function parseAnimalRef(body) {
  const ref = clean(body.animal_ref);
  if (ref && ref.includes(':')) {
    const [type, id] = ref.split(':');
    if (type === 'dog') return { animalType: 'dog', dogId: id, puppyId: null };
    if (type === 'puppy') return { animalType: 'puppy', dogId: null, puppyId: id };
  }
  if (clean(body.dog_id)) return { animalType: 'dog', dogId: clean(body.dog_id), puppyId: null };
  if (clean(body.puppy_id)) return { animalType: 'puppy', dogId: null, puppyId: clean(body.puppy_id) };
  return { animalType: null, dogId: null, puppyId: null };
}

async function ensureStructureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS infrastructures (
      id SERIAL PRIMARY KEY,
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(80) DEFAULT 'box',
      description TEXT,
      capacity INTEGER DEFAULT 0,
      status VARCHAR(80) DEFAULT 'actif',
      image_url TEXT,
      zone_label VARCHAR(120),
      occupied_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS description TEXT');
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS image_url TEXT');
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS zone_label VARCHAR(120)');
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS occupied_count INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE infrastructures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
  await pool.query('ALTER TABLE dogs ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER');
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS infrastructure_id INTEGER');
  await pool.query('ALTER TABLE puppies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS infrastructure_assignments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      breeder_id UUID NOT NULL REFERENCES breeder(id) ON DELETE CASCADE,
      infrastructure_id INTEGER REFERENCES infrastructures(id) ON DELETE SET NULL,
      previous_infrastructure_id INTEGER REFERENCES infrastructures(id) ON DELETE SET NULL,
      animal_type VARCHAR(20) NOT NULL CHECK (animal_type IN ('dog', 'puppy')),
      dog_id UUID REFERENCES dogs(id) ON DELETE CASCADE,
      puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE,
      reason TEXT,
      sanitary_context VARCHAR(120),
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CHECK ((animal_type = 'dog' AND dog_id IS NOT NULL AND puppy_id IS NULL) OR (animal_type = 'puppy' AND puppy_id IS NOT NULL AND dog_id IS NULL))
    )
  `);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_dog ON infrastructure_assignments(breeder_id, dog_id) WHERE ended_at IS NULL AND dog_id IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_infra_active_puppy ON infrastructure_assignments(breeder_id, puppy_id) WHERE ended_at IS NULL AND puppy_id IS NOT NULL');
}

async function seedDefaultInfrastructures(breederId) {
  const existing = await pool.query('SELECT COUNT(*)::int AS total FROM infrastructures WHERE breeder_id = $1', [breederId]);
  if ((existing.rows[0]?.total || 0) > 0) return;
  for (const item of DEFAULT_INFRASTRUCTURES) {
    const visual = visualFor(item);
    await pool.query(
      `INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url, zone_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [breederId, item.name, item.type, visual.description, item.capacity, item.status, visual.imageUrl, visual.label],
    );
  }
}

async function refreshPresentationAndOccupancy(clientOrPool, breederId) {
  const rows = await clientOrPool.query('SELECT * FROM infrastructures WHERE breeder_id = $1', [breederId]);
  for (const infra of rows.rows) {
    const visual = visualFor(infra);
    await clientOrPool.query(
      `UPDATE infrastructures
       SET description = COALESCE(NULLIF(description, ''), $1),
           image_url = COALESCE(NULLIF(image_url, ''), $2),
           zone_label = COALESCE(NULLIF(zone_label, ''), $3)
       WHERE id = $4 AND breeder_id = $5`,
      [visual.description, visual.imageUrl, visual.label, infra.id, breederId],
    );
  }
  await clientOrPool.query(
    `UPDATE infrastructures i
     SET occupied_count =
       (SELECT COUNT(*)::int FROM dogs d WHERE d.breeder_id = $1 AND d.infrastructure_id = i.id) +
       (SELECT COUNT(*)::int FROM puppies p WHERE p.breeder_id = $1 AND p.infrastructure_id = i.id AND COALESCE(p.is_sold, false) = false),
       updated_at = CURRENT_TIMESTAMP
     WHERE i.breeder_id = $1`,
    [breederId],
  );
}

async function safeRows(query, params = []) {
  return pool.query(query, params).then((result) => result.rows).catch(() => []);
}

async function safeCount(query, params = []) {
  const result = await pool.query(query, params).catch(() => ({ rows: [{ total: 0 }] }));
  return Number(result.rows[0]?.total || 0);
}

function buildSanitaryCompliance({ sanitaryCount, cleaningCount, movementCount }) {
  const missing = [];
  if (!sanitaryCount) missing.push('registre sanitaire');
  if (!cleaningCount) missing.push('journal de nettoyage / désinfection');
  if (!movementCount) missing.push('registre des entrées et sorties');
  const score = Math.round(((3 - missing.length) / 3) * 100);
  const message = score === 100 ? 'Tous les registres réglementaires sont alimentés.' : score === 0 ? 'Aucune donnée réglementaire saisie : le suivi DDPP est à initialiser.' : 'Suivi réglementaire partiel : des registres restent à compléter.';
  return { score, missing, message };
}

function animalLabel(row) {
  return [row.name || 'Sans nom', row.sex, row.breed].filter(Boolean).join(' · ');
}

exports.index = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    await seedDefaultInfrastructures(breederId);
    await refreshPresentationAndOccupancy(pool, breederId);

    const infrastructuresResult = await pool.query(
      `SELECT i.*,
        COALESCE(dc.total, 0) + COALESCE(pc.total, 0) AS computed_occupied
       FROM infrastructures i
       LEFT JOIN (SELECT infrastructure_id, COUNT(*)::int AS total FROM dogs WHERE breeder_id = $1 AND infrastructure_id IS NOT NULL GROUP BY infrastructure_id) dc ON dc.infrastructure_id = i.id
       LEFT JOIN (SELECT infrastructure_id, COUNT(*)::int AS total FROM puppies WHERE breeder_id = $1 AND infrastructure_id IS NOT NULL AND COALESCE(is_sold, false) = false GROUP BY infrastructure_id) pc ON pc.infrastructure_id = i.id
       WHERE i.breeder_id = $1
       ORDER BY i.type ASC, i.name ASC`,
      [breederId],
    );

    const dogs = await safeRows(
      `SELECT d.id, d.name, d.sex, d.breed, d.status, d.chip_number, d.infrastructure_id, i.name AS infrastructure_name
       FROM dogs d LEFT JOIN infrastructures i ON i.id = d.infrastructure_id AND i.breeder_id = d.breeder_id
       WHERE d.breeder_id = $1 ORDER BY d.name ASC`,
      [breederId],
    );

    const puppies = await safeRows(
      `SELECT p.id, p.name, p.sex, p.color AS breed, p.status, p.chip_number, p.infrastructure_id, i.name AS infrastructure_name
       FROM puppies p LEFT JOIN infrastructures i ON i.id = p.infrastructure_id AND i.breeder_id = p.breeder_id
       WHERE p.breeder_id = $1 AND COALESCE(p.is_sold, false) = false
       ORDER BY p.name ASC NULLS LAST, p.created_at ASC`,
      [breederId],
    );

    const residents = [
      ...dogs.filter((dog) => dog.infrastructure_id).map((dog) => ({ ...dog, animal_type: 'dog', animal_ref: `dog:${dog.id}`, display_name: animalLabel(dog) })),
      ...puppies.filter((puppy) => puppy.infrastructure_id).map((puppy) => ({ ...puppy, animal_type: 'puppy', animal_ref: `puppy:${puppy.id}`, display_name: animalLabel(puppy) })),
    ];

    const residentsByInfrastructure = residents.reduce((acc, resident) => {
      const key = String(resident.infrastructure_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(resident);
      return acc;
    }, {});

    const infrastructures = infrastructuresResult.rows.map((item) => {
      const visual = visualFor(item);
      const itemResidents = residentsByInfrastructure[String(item.id)] || [];
      const occupied = itemResidents.length || Number(item.computed_occupied || item.occupied_count || 0);
      const capacity = Number(item.capacity || 0);
      const status = displayStatus(item.status, occupied, capacity);
      return {
        ...item,
        occupied,
        capacity,
        residents: itemResidents,
        freePlaces: capacity > 0 ? Math.max(0, capacity - occupied) : null,
        icon: visual.icon,
        cardImageUrl: item.image_url || visual.imageUrl,
        description: item.description || visual.description,
        zone_label: item.zone_label || visual.label,
        occupancyRate: capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0,
        displayStatus: status,
        statusClass: slugClass(status),
      };
    });

    const history = await safeRows(
      `SELECT ia.*, COALESCE(d.name, p.name, 'Animal supprimé') AS animal_name,
              COALESCE(i.name, 'Non assigné') AS infrastructure_name,
              COALESCE(pi.name, 'Non assigné') AS previous_infrastructure_name
       FROM infrastructure_assignments ia
       LEFT JOIN dogs d ON d.id = ia.dog_id
       LEFT JOIN puppies p ON p.id = ia.puppy_id
       LEFT JOIN infrastructures i ON i.id = ia.infrastructure_id
       LEFT JOIN infrastructures pi ON pi.id = ia.previous_infrastructure_id
       WHERE ia.breeder_id = $1
       ORDER BY ia.assigned_at DESC, ia.created_at DESC
       LIMIT 10`,
      [breederId],
    );

    const staff = await safeRows('SELECT * FROM staff WHERE breeder_id = $1 ORDER BY status ASC NULLS LAST, role ASC NULLS LAST, last_name ASC NULLS LAST LIMIT 8', [breederId]);
    const movements = await safeRows('SELECT * FROM movements WHERE breeder_id = $1 ORDER BY movement_date DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 3', [breederId]);
    const sanitary = await safeRows('SELECT * FROM sanitary_records WHERE breeder_id = $1 ORDER BY event_date DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 3', [breederId]);
    const cleaning = await safeRows('SELECT * FROM cleaning_logs WHERE breeder_id = $1 ORDER BY cleaning_date DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 3', [breederId]);

    const sanitaryCount = await safeCount('SELECT COUNT(*)::int AS total FROM sanitary_records WHERE breeder_id = $1', [breederId]);
    const cleaningCount = await safeCount('SELECT COUNT(*)::int AS total FROM cleaning_logs WHERE breeder_id = $1', [breederId]);
    const movementCount = await safeCount('SELECT COUNT(*)::int AS total FROM movements WHERE breeder_id = $1', [breederId]);
    const sanitaryCompliance = buildSanitaryCompliance({ sanitaryCount, cleaningCount, movementCount });

    res.render('structure/index', {
      title: 'Gestion de la structure',
      infrastructures,
      assignableDogs: dogs,
      assignablePuppies: puppies,
      assignmentHistory: history,
      staff,
      movements,
      sanitary,
      cleaning,
      stats: {
        totalCapacity: infrastructures.reduce((sum, item) => sum + Number(item.capacity || 0), 0),
        totalOccupied: infrastructures.reduce((sum, item) => sum + Number(item.occupied || 0), 0),
        unassignedDogs: dogs.filter((dog) => !dog.infrastructure_id).length,
        unassignedPuppies: puppies.filter((puppy) => !puppy.infrastructure_id).length,
        sanitaryScore: sanitaryCompliance.score,
        sanitaryMissing: sanitaryCompliance.missing,
        sanitaryMessage: sanitaryCompliance.message,
        sanitaryCounts: { sanitaryCount, cleaningCount, movementCount },
      },
    });
  } catch (error) {
    console.error('Erreur structure:', error);
    setFlash(req, 'error', 'Erreur lors du chargement de la gestion de structure.');
    res.redirect('/dashboard');
  }
};

exports.storeInfrastructure = async (req, res) => {
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    const name = clean(req.body.name);
    if (!name) {
      setFlash(req, 'error', 'Le nom du bâtiment ou du box est obligatoire.');
      return res.redirect('/structure');
    }
    const type = clean(req.body.type) || 'box';
    const visual = visualFor({ name, type, description: req.body.description });
    const capacity = Math.max(0, Number.parseInt(req.body.capacity || '0', 10) || 0);
    await pool.query(
      `INSERT INTO infrastructures (breeder_id, name, type, description, capacity, status, image_url, zone_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [breederId, name, type, clean(req.body.description) || visual.description, capacity, clean(req.body.status) || 'actif', clean(req.body.image_url) || visual.imageUrl, visual.label],
    );
    setFlash(req, 'success', 'Infrastructure créée avec succès.');
    res.redirect('/structure');
  } catch (error) {
    console.error('Erreur création infrastructure:', error);
    setFlash(req, 'error', 'Erreur lors de la création du bâtiment.');
    res.redirect('/structure');
  }
};

exports.assignInfrastructure = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStructureSchema();
    const breederId = req.session.user.breeder_id;
    const infrastructureId = parseNullableInteger(req.body.infrastructure_id);
    const { animalType, dogId, puppyId } = parseAnimalRef(req.body);
    if (!animalType) {
      setFlash(req, 'error', 'Sélectionnez un chien ou un chiot à affecter.');
      return res.redirect('/structure');
    }

    await client.query('BEGIN');
    const animalQuery = animalType === 'dog'
      ? ['SELECT id, name, infrastructure_id FROM dogs WHERE id = $1 AND breeder_id = $2 FOR UPDATE', [dogId, breederId]]
      : ['SELECT id, name, infrastructure_id FROM puppies WHERE id = $1 AND breeder_id = $2 AND COALESCE(is_sold, false) = false FOR UPDATE', [puppyId, breederId]];
    const animalResult = await client.query(animalQuery[0], animalQuery[1]);
    const animal = animalResult.rows[0];
    if (!animal) {
      await client.query('ROLLBACK');
      setFlash(req, 'error', animalType === 'dog' ? 'Chien introuvable pour cet élevage.' : 'Chiot introuvable ou déjà vendu.');
      return res.redirect('/structure');
    }

    let target = null;
    if (infrastructureId) {
      const targetResult = await client.query(
        `SELECT i.*, COALESCE(dc.total, 0) + COALESCE(pc.total, 0) AS occupied
         FROM infrastructures i
         LEFT JOIN (SELECT infrastructure_id, COUNT(*)::int AS total FROM dogs WHERE breeder_id = $1 GROUP BY infrastructure_id) dc ON dc.infrastructure_id = i.id
         LEFT JOIN (SELECT infrastructure_id, COUNT(*)::int AS total FROM puppies WHERE breeder_id = $1 AND COALESCE(is_sold, false) = false GROUP BY infrastructure_id) pc ON pc.infrastructure_id = i.id
         WHERE i.id = $2 AND i.breeder_id = $1`,
        [breederId, infrastructureId],
      );
      target = targetResult.rows[0];
      if (!target) {
        await client.query('ROLLBACK');
        setFlash(req, 'error', 'Box ou infrastructure introuvable pour cet élevage.');
        return res.redirect('/structure');
      }
      if (Number(target.capacity || 0) > 0 && Number(target.occupied || 0) >= Number(target.capacity || 0)) {
        await client.query('ROLLBACK');
        setFlash(req, 'error', `${target.name} est complet. Libérez une place avant d’affecter un nouvel animal.`);
        return res.redirect('/structure');
      }
    }

    if ((animal.infrastructure_id || null) === infrastructureId) {
      await client.query('ROLLBACK');
      setFlash(req, 'warning', `${animal.name || 'Animal'} est déjà affecté à cet emplacement.`);
      return res.redirect('/structure');
    }

    if (animalType === 'dog') {
      await client.query('UPDATE infrastructure_assignments SET ended_at = CURRENT_TIMESTAMP WHERE breeder_id = $1 AND dog_id = $2 AND ended_at IS NULL', [breederId, dogId]);
      await client.query('UPDATE dogs SET infrastructure_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND breeder_id = $3', [infrastructureId, dogId, breederId]);
    } else {
      await client.query('UPDATE infrastructure_assignments SET ended_at = CURRENT_TIMESTAMP WHERE breeder_id = $1 AND puppy_id = $2 AND ended_at IS NULL', [breederId, puppyId]);
      await client.query('UPDATE puppies SET infrastructure_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND breeder_id = $3', [infrastructureId, puppyId, breederId]);
    }

    await client.query(
      `INSERT INTO infrastructure_assignments (breeder_id, infrastructure_id, previous_infrastructure_id, animal_type, dog_id, puppy_id, reason, sanitary_context, ended_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $2::integer IS NULL THEN CURRENT_TIMESTAMP ELSE NULL END, $9)`,
      [breederId, infrastructureId, animal.infrastructure_id || null, animalType, dogId, puppyId, clean(req.body.reason), clean(req.body.sanitary_context), req.session.user.id],
    );

    await refreshPresentationAndOccupancy(client, breederId);
    await client.query('COMMIT');
    setFlash(req, 'success', `${animal.name || 'Animal'} affecté vers : ${target?.name || 'non assigné'}.`);
    res.redirect('/structure');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur assignation infrastructure:', error);
    setFlash(req, 'error', "Erreur lors de l'assignation.");
    res.redirect('/structure');
  } finally {
    client.release();
  }
};
