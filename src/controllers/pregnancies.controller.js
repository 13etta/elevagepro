const { pool } = require('../db');

exports.listPregnancies = async (req, res) => {
    // Garde ton listPregnancies actuel
};

exports.getForm = async (req, res) => {
    // Garde ton getForm actuel
};

exports.savePregnancy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const pregId = req.params.id;
        const { mating_id, female_id, start_date, notes } = req.body;
        let { expected_date, due_date, result } = req.body;

        // 🧠 AUTOMATISATION 1 : Calcul si l'utilisateur modifie les dates
        if (start_date && !expected_date) {
            let start = new Date(start_date);
            start.setDate(start.getDate() + 63);
            expected_date = start.toISOString().split('T')[0];
        }

        // 🧠 AUTOMATISATION 2 : Si date de mise bas réelle renseignée, la gestation passe "Réussie"
        if (due_date && result === 'En cours') {
            result = 'Réussie';
        }

        if (pregId) {
            await pool.query(`
                UPDATE pregnancies 
                SET mating_id = $1, female_id = $2, start_date = $3, expected_date = $4, due_date = $5, result = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
                WHERE id = $8 AND breeder_id = $9
            `, [mating_id || null, female_id, start_date, expected_date || null, due_date || null, result, notes, pregId, breederId]);
        } else {
            await pool.query(`
                INSERT INTO pregnancies (breeder_id, mating_id, female_id, start_date, expected_date, due_date, result, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [breederId, mating_id || null, female_id, start_date, expected_date || null, due_date || null, result, notes]);
        }

        res.redirect('/pregnancies');
    } catch (error) {
        console.error('Erreur sauvegarde gestation:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.deletePregnancy = async (req, res) => {
    // Garde ton deletePregnancy actuel
};