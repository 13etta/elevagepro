const { pool } = require('../db');

exports.listPregnancies = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, female, status } = req.query;

        let query = `
            SELECT p.*, f.name AS female_name
            FROM pregnancies p
            LEFT JOIN dogs f ON p.female_id = f.id
            WHERE p.breeder_id = $1
        `;
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (f.name ILIKE $${params.length} OR p.notes ILIKE $${params.length})`;
        }
        if (female) {
            params.push(female);
            query += ` AND f.id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND p.result = $${params.length}`;
        }

        query += ' ORDER BY p.start_date DESC';
        const result = await pool.query(query, params);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        res.render('pregnancies/index', { pregnancies: result.rows, females: females.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste gestations:', error);
        res.status(500).send('Erreur lors du chargement des gestations.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const pregId = req.params.id;
        const matingId = req.query.mating_id; // Si on vient du bouton "Déclarer gestation" depuis une saillie

        let preg = { result: 'En cours' };

        // Si c'est une modification
        if (pregId) {
            const pregRes = await pool.query('SELECT * FROM pregnancies WHERE id = $1 AND breeder_id = $2', [pregId, breederId]);
            if (pregRes.rows.length > 0) preg = pregRes.rows[0];
        } 
        // Si c'est une création pré-remplie depuis une saillie
        else if (matingId) {
            const matingRes = await pool.query('SELECT female_id, mating_date FROM matings WHERE id = $1 AND breeder_id = $2', [matingId, breederId]);
            if (matingRes.rows.length > 0) {
                preg.mating_id = matingId;
                preg.female_id = matingRes.rows[0].female_id;
                preg.start_date = matingRes.rows[0].mating_date;
                
                // Calcul automatique des 63 jours
                let start = new Date(preg.start_date);
                start.setDate(start.getDate() + 63);
                preg.expected_date = start.toISOString().split('T')[0];
            }
        }

        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status = 'Actif' ORDER BY name ASC", [breederId]);
        
        res.render('pregnancies/form', { preg, females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.savePregnancy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const pregId = req.params.id;
        const { mating_id, female_id, start_date, expected_date, due_date, result, notes } = req.body;

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
    try {
        await pool.query('DELETE FROM pregnancies WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/pregnancies');
    } catch (error) {
        res.status(500).send('Erreur suppression.');
    }
};