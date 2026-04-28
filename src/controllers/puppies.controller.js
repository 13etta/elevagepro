const { pool } = require('../db');

exports.listPuppies = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

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
          l.birth_date AS litter_birth_date,
          d.name AS mother_name
        FROM puppies p
        LEFT JOIN litters l ON p.litter_id = l.id
        LEFT JOIN dogs d ON l.mother_id = d.id
        WHERE p.breeder_id = $1
        ORDER BY l.birth_date DESC NULLS LAST, p.created_at DESC
      `,
      [breederId],
    );

    res.render('puppies/index', {
      title: 'Chiots',
      puppies: result.rows,
    });
  } catch (error) {
    console.error('Erreur liste chiots:', error);
    res.status(500).send('Erreur serveur lors du chargement des chiots.');
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
