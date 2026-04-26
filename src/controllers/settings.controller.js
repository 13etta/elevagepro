const { pool } = require('../db');

exports.getSettings = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // Récupération des informations actuelles de l'élevage
        const result = await pool.query('SELECT * FROM breeder WHERE id = $1', [breederId]);
        
        res.render('settings/index', {
            breeder: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur lecture paramètres:', error);
        res.status(500).send('Erreur lors du chargement des paramètres.');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { company_name, affix_name, siret, address } = req.body;

        // Mise à jour des informations textuelles
        await pool.query(`
            UPDATE breeder 
            SET company_name = $1, 
                affix_name = $2, 
                siret = $3, 
                address = $4, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
        `, [company_name, affix_name, siret, address, breederId]);

        res.redirect('/settings');
    } catch (error) {
        console.error('Erreur mise à jour paramètres:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};