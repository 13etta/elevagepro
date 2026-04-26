const { pool } = require('../db');

exports.getEntryExitRegistry = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // Récupération de tous les mouvements, triés du plus récent au plus ancien
        const movementsRes = await pool.query(`
            SELECT * FROM movements 
            WHERE breeder_id = $1 
            ORDER BY movement_date DESC, created_at DESC
        `, [breederId]);

        res.render('registries/index', {
            movements: movementsRes.rows
        });
    } catch (error) {
        console.error('Erreur registre entrées/sorties:', error);
        res.status(500).send('Erreur lors de la génération du registre légal.');
    }
};

// Fonction pour déclarer manuellement un décès ou une mise à la retraite
exports.declareManualExit = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { dog_id, dog_name, chip_number, reason, movement_date, notes } = req.body;

        await pool.query('BEGIN');

        // 1. Inscription au registre
        await pool.query(`
            INSERT INTO movements (breeder_id, animal_type, animal_name, chip_number, movement_type, reason, movement_date, provenance_destination)
            VALUES ($1, 'adulte', $2, $3, 'sortie', $4, $5, $6)
        `, [breederId, dog_name, chip_number || 'Non pucé', reason, movement_date, notes]);

        // 2. Mise à jour du statut du chien
        await pool.query(`
            UPDATE dogs SET status = $1 WHERE id = $2 AND breeder_id = $3
        `, [reason === 'deces' ? 'decede' : 'retraite', dog_id, breederId]);

        await pool.query('COMMIT');
        res.redirect('/registries');
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erreur déclaration sortie:', error);
        res.status(500).send('Erreur lors de la déclaration.');
    }
};