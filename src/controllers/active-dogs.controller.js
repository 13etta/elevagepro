const { pool } = require('../db');

exports.listActiveDogIds = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;
    const result = await pool.query(
      `SELECT id
       FROM dogs
       WHERE breeder_id = $1
         AND LOWER(COALESCE(status, 'actif')) <> 'sorti'`,
      [breederId],
    );

    return res.json({
      activeDogIds: result.rows.map((row) => String(row.id)),
    });
  } catch (error) {
    console.error('Erreur chargement identifiants chiens actifs:', error);
    return res.status(500).json({ activeDogIds: [] });
  }
};
