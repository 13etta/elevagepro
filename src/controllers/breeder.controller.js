const { pool } = require('../db');

exports.showBreederProfile = async (req, res) => {
  try {
    const breederId = req.session.user.breeder_id;

    const result = await pool.query(
      'SELECT * FROM breeder WHERE id = $1',
      [breederId],
    );

    res.render('breeder/show', {
      title: 'Identité élevage',
      breeder: result.rows[0] || {},
    });
  } catch (error) {
    console.error('Erreur profil élevage:', error);
    res.status(500).send('Erreur lors du chargement de l’identité élevage.');
  }
};
