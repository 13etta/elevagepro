const { pool } = require('../db');

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
        LEFT JOIN dogs father ON l.father_id = father.id
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
    const { litter_id, name, sex, color, chip_number, status, sale_price } = req.body;

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
        [litter_id, name, sex, color, chip_number, status, sale_price || null, puppyId, breederId],
      );
    } else {
      await pool.query(
        `
          INSERT INTO puppies (breeder_id, litter_id, name, sex, color, chip_number, status, sale_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [breederId, litter_id, name, sex, color, chip_number, status, sale_price || null],
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
