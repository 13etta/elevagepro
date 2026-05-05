const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // 1. Récupération des infrastructures
        const infraRes = await pool.query(
            'SELECT * FROM infrastructures WHERE breeder_id = $1 ORDER BY type ASC, name ASC',
            [breederId]
        );

        // 2. Récupération de l'équipe
        const staffRes = await pool.query(
            'SELECT * FROM staff WHERE breeder_id = $1 ORDER BY status ASC, last_name ASC',
            [breederId]
        );

        // 3. (Futur) Récupération des derniers mouvements pour le registre
        // const movementsRes = await pool.query('...');

        res.render('breeder/index', {
            title: 'Gestion de l\'élevage',
            infrastructures: infraRes.rows,
            staff: staffRes.rows
        });

    } catch (error) {
        console.error('Erreur lors du chargement du module Breeder:', error);
        res.status(500).send('Erreur serveur lors du chargement du module de gestion de l\'élevage.');
    }
};