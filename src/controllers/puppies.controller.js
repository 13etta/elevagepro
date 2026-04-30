const { pool } = require('../db');
const { generatePuppyAd } = require('../services/puppy-ad-agent.service');

function normalizePuppyStatus(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (['vendu', 'vendue', 'sold'].includes(raw)) return 'Vendu';
  if (['réservé', 'reserve', 'reserved', 'reservation', 'réservation', 'option'].includes(raw)) return 'Reserve';
  if (['décédé', 'decede', 'dead'].includes(raw)) return 'Decede';
  if (['actif', 'active', 'disponible', 'available', 'disponible (actif)'].includes(raw)) return 'Actif';

  return 'Actif';
}

function normalizeSex(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'M' || raw.startsWith('MÂ') || raw.startsWith('MA')) return 'M';
  if (raw === 'F' || raw.startsWith('FE') || raw.startsWith('FÉ')) return 'F';
  return null;
}

function normalizeSalePrice(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeNullableText(value, maxLength = null) {
  const text = String(value || '').trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

function buildPuppyFilters(query, breederId) {
  const values = [breederId];
  const where = ['p.breeder_id = $1'];

  if (query.q) {
    values.push(`%${query.q.trim()}%`);
    where.push(`(
      p.name ILIKE $${values.length}
      OR p.chip_number ILIKE $${values.length}
      OR p.color ILIKE $${values.length}
      OR p.status ILIKE $${values.length}
    )`);
  }

  if (query.sex) {
    values.push(query.sex);
    where.push(`p.sex = $${values.length}`);
  }

  if (query.color) {
    values.push(query.color);
    where.push(`p.color = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    where.push(`p.status = $${values.length}`);
  }

  if (query.sale_state === 'sold') {
    where.push(`COALESCE(p.is_sold, false) = true`);
  }

  if (query.sale_state === 'available') {
    where.push(`COALESCE(p.is_sold, false) = false`);
    where.push(`COALESCE(lower(p.status), '') NOT IN ('vendu', 'vendue', 'sold')`);
  }

  if (query.sale_state === 'reserved') {
    where.push(`COALESCE(lower(p.status), '') IN ('réservé', 'reserve', 'reserved', 'option', 'réservation')`);
  }

  return {
    values,
    whereSql: where.join(' AND '),
  };
}

async function fetchPuppies(req) {
  const breederId = req.session.user.breeder_id;
  const filters = buildPuppyFilters(req.query, breederId);

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.litter_id,
        p.name,
        p.sex,
        p.color,
        p.chip_number,
        p.status,
        p.sale_price,
        p.created_at,
        COALESCE(p.is_sold, false) AS is_sold,
        l.birth_date AS litter_birth_date,
        d.name AS mother_name
      FROM puppies p
      LEFT JOIN litters l ON p.litter_id = l.id
      LEFT JOIN dogs d ON l.mother_id = d.id
      WHERE ${filters.whereSql}
      ORDER BY l.birth_date DESC NULLS LAST, p.created_at DESC
    `,
    filters.values,
  );

  return result.rows;
}

async function fetchFilterOptions(breederId) {
  const [colors, statuses] = await Promise.all([
    pool.query(
      `
        SELECT DISTINCT color
        FROM puppies
        WHERE breeder_id = $1
          AND color IS NOT NULL
          AND trim(color) <> ''
        ORDER BY color ASC
      `,
      [breederId],
    ),
    pool.query(
      `
        SELECT DISTINCT status
        FROM puppies
        WHERE breeder_id = $1
          AND status IS NOT NULL
          AND trim(status) <> ''
        ORDER BY status ASC
      `,
      [breederId],
    ),
  ]);

  return {
    colors: colors.rows.map((row) => row.color),
    statuses: statuses.rows.map((row) => row.status),
  };
}

async function fetchPuppyAdContext(breederId, puppyId) {
  const puppyResult = await pool.query(
    `
      SELECT
        p.*,
        l.birth_date AS litter_birth_date,
        l.notes AS litter_notes,
        l.puppies_count_total,
        l.status AS litter_status,
        mother.name AS mother_name,
        mother.breed AS mother_breed,
        father.name AS father_name,
        father.breed AS father_breed
      FROM puppies p
      LEFT JOIN litters l ON p.litter_id = l.id
      LEFT JOIN dogs mother ON l.mother_id = mother.id
      LEFT JOIN matings m ON l.mating_id = m.id
      LEFT JOIN dogs father ON m.male_id = father.id
      WHERE p.id = $1 AND p.breeder_id = $2
      LIMIT 1
    `,
    [puppyId, breederId],
  );

  if (!puppyResult.rows.length) return null;

  const breederResult = await pool.query(
    `
      SELECT id, company_name, name, affix_name, siret, producer_number, website_settings
      FROM breeder
      WHERE id = $1
      LIMIT 1
    `,
    [breederId],
  );

  const puppy = puppyResult.rows[0];

  return {
    puppy,
    litter: {
      birth_date: puppy.litter_birth_date,
      notes: puppy.litter_notes,
      puppies_count_total: puppy.puppies_count_total,
      status: puppy.litter_status,
    },
    parents: {
      mother_name: puppy.mother_name,
      father_name: puppy.father_name,
      breed: puppy.mother_breed || puppy.father_breed,
    },
    breeder: breederResult.rows[0] || {},
  };
}

exports.listPuppies = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const [puppies, filterOptions] = await Promise.all([
      fetchPuppies(req),
      fetchFilterOptions(breederId),
    ]);

    res.render('puppies/index', {
      title: 'Chiots',
      puppies,
      filters: req.query,
      ...filterOptions,
    });
  } catch (error) {
    console.error('Erreur liste chiots:', error);
    res.status(500).send('Erreur serveur lors du chargement des chiots.');
  }
};

exports.listPuppiesFragment = async (req, res) => {
  try {
    const puppies = await fetchPuppies(req);

    res.render('puppies/_rows', {
      puppies,
      layout: false,
    });
  } catch (error) {
    console.error('Erreur fragment chiots:', error);
    res.status(500).send('Erreur serveur lors du filtrage des chiots.');
  }
};

exports.showPuppy = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const puppyId = req.params.id;

    const puppyResult = await pool.query(
      `
        SELECT p.*,
               l.birth_date AS litter_birth_date,
               mother.name AS mother_name,
               father.name AS father_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs mother ON l.mother_id = mother.id
        LEFT JOIN matings m ON l.mating_id = m.id
        LEFT JOIN dogs father ON m.male_id = father.id
        WHERE p.id = $1 AND p.breeder_id = $2
      `,
      [puppyId, breederId],
    );

    if (!puppyResult.rows.length) {
      return res.status(404).render('errors/404', {
        title: 'Chiot introuvable',
        user: req.session.user,
      });
    }

    const soins = await pool.query(
      `
        SELECT id, type, label, event_date, next_due
        FROM soins
        WHERE breeder_id = $1 AND puppy_id = $2
        ORDER BY event_date DESC
        LIMIT 10
      `,
      [breederId, puppyId],
    ).catch(() => ({ rows: [] }));

    const reminders = await pool.query(
      `
        SELECT id, type, title, due_date, is_completed
        FROM reminders
        WHERE breeder_id = $1
          AND puppy_id = $2
          AND is_completed = FALSE
        ORDER BY due_date ASC
        LIMIT 10
      `,
      [breederId, puppyId],
    ).catch(() => ({ rows: [] }));

    const sales = await pool.query(
      `
        SELECT id, buyer_name, sale_date, price, deposit_amount, is_reservation
        FROM sales
        WHERE breeder_id = $1 AND puppy_id = $2
        ORDER BY sale_date DESC
        LIMIT 5
      `,
      [breederId, puppyId],
    );

    res.render('puppies/show', {
      title: puppyResult.rows[0].name || 'Fiche chiot',
      puppy: puppyResult.rows[0],
      soins: soins.rows,
      reminders: reminders.rows,
      sales: sales.rows,
    });
  } catch (error) {
    console.error('Erreur fiche chiot:', error);
    res.status(500).send('Erreur lors du chargement de la fiche chiot.');
  }
};

exports.generatePuppyAd = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const puppyId = req.params.id;
    const context = await fetchPuppyAdContext(breederId, puppyId);

    if (!context) {
      return res.status(404).json({ error: 'Chiot introuvable.' });
    }

    const result = await generatePuppyAd(context, {
      tone: req.body.tone || 'professional',
      showChipNumber: req.body.show_chip_number,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erreur génération annonce chiot:', error);
    return res.status(500).json({ error: 'Erreur lors de la génération de l’annonce.' });
  }
};

exports.getForm = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const puppyId = req.params.id;
    const litterId = req.query.litter_id;

    let puppy = { status: 'Actif', litter_id: litterId };

    if (puppyId) {
      const puppyRes = await pool.query('SELECT * FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
      if (puppyRes.rows.length > 0) puppy = puppyRes.rows[0];
    } else if (litterId) {
      const litterRes = await pool.query(
        'SELECT birth_date FROM litters WHERE id = $1 AND breeder_id = $2',
        [litterId, breederId],
      );
      if (litterRes.rows.length > 0) {
        puppy.birth_date = litterRes.rows[0].birth_date;
      }
    }

    const litters = await pool.query(
      `
        SELECT l.id, d.name as mother_name, l.birth_date
        FROM litters l
        JOIN dogs d ON l.mother_id = d.id
        WHERE l.breeder_id = $1
        ORDER BY l.birth_date DESC
      `,
      [breederId],
    );

    res.render('puppies/form', { puppy, litters: litters.rows });
  } catch (error) {
    console.error('Erreur formulaire chiot:', error);
    res.status(500).send('Erreur serveur.');
  }
};

exports.savePuppy = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const puppyId = req.params.id;
    const puppyData = {
      litter_id: req.body.litter_id,
      name: normalizeNullableText(req.body.name, 120),
      sex: normalizeSex(req.body.sex),
      color: normalizeNullableText(req.body.color, 80),
      chip_number: normalizeNullableText(req.body.chip_number, 30),
      status: normalizePuppyStatus(req.body.status),
      sale_price: normalizeSalePrice(req.body.sale_price),
    };

    if (!puppyData.litter_id || !puppyData.name || !puppyData.sex) {
      return res.status(400).send('Portée, nom et sexe du chiot sont obligatoires.');
    }

    if (puppyId) {
      await pool.query(
        `
          UPDATE puppies
          SET litter_id = $1,
              name = $2,
              sex = $3,
              color = $4,
              chip_number = $5,
              status = $6,
              sale_price = $7
          WHERE id = $8 AND breeder_id = $9
        `,
        [
          puppyData.litter_id,
          puppyData.name,
          puppyData.sex,
          puppyData.color,
          puppyData.chip_number,
          puppyData.status,
          puppyData.sale_price,
          puppyId,
          breederId,
        ],
      );
    } else {
      await pool.query(
        `
          INSERT INTO puppies (breeder_id, litter_id, name, sex, color, chip_number, status, sale_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          breederId,
          puppyData.litter_id,
          puppyData.name,
          puppyData.sex,
          puppyData.color,
          puppyData.chip_number,
          puppyData.status,
          puppyData.sale_price,
        ],
      );
    }

    res.redirect('/puppies');
  } catch (error) {
    console.error('Erreur sauvegarde chiot:', error);
    res.status(500).send('Erreur lors de la sauvegarde.');
  }
};

exports.deletePuppy = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const puppyId = req.params.id;

    await pool.query('DELETE FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
    res.redirect('/puppies');
  } catch (error) {
    console.error('Erreur suppression chiot:', error);
    res.status(500).send('Erreur suppression.');
  }
};
