const { pool } = require('../db');

exports.listHeats = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const result = await pool.query(`
            SELECT h.*, d.name AS dog_name
            FROM heats h JOIN dogs d ON h.dog_id = d.id
            WHERE h.breeder_id = $1 ORDER BY h.start_date DESC
        `, [breederId]);
        res.render('heats/index', { heats: result.rows });
    } catch (error) {
        res.status(500).send('Erreur lors du chargement du module des chaleurs.');
    }
};

exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const females = await pool.query(`
            SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu') ORDER BY name ASC
        `, [breederId]);
        res.render('heats/new', { females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.createHeat = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        let { dog_id, start_date, end_date, stage, notes } = req.body;

        // 🧠 AUTOMATISATION : +21 jours pour la fin des chaleurs si laissé vide
        if (start_date && !end_date) {
            let startDateObj = new Date(start_date);
            startDateObj.setDate(startDateObj.getDate() + 21);
            end_date = startDateObj.toISOString().split('T')[0];
        }

        await pool.query(`
            INSERT INTO heats (breeder_id, dog_id, start_date, end_date, stage, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [breederId, dog_id, start_date, end_date || null, stage, notes]);
        res.redirect('/heats');
    } catch (error) {
        res.status(500).send('Erreur de sauvegarde.');
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const heatResult = await pool.query('SELECT * FROM heats WHERE id = $1 AND breeder_id = $2', [req.params.id, breederId]);
        const females = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F'`, [breederId]);
        res.render('heats/edit', { heat: heatResult.rows[0], females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.updateHeat = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        let { dog_id, start_date, end_date, stage, notes } = req.body;

        // 🧠 AUTOMATISATION : Recalcul si l'utilisateur efface la date de fin
        if (start_date && !end_date) {
            let startDateObj = new Date(start_date);
            startDateObj.setDate(startDateObj.getDate() + 21);
            end_date = startDateObj.toISOString().split('T')[0];
        }

        await pool.query(`
            UPDATE heats SET dog_id = $1, start_date = $2, end_date = $3, stage = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND breeder_id = $7
        `, [dog_id, start_date, end_date || null, stage, notes, req.params.id, breederId]);
        res.redirect('/heats');
    } catch (error) {
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.deleteHeat = async (req, res) => {
    try {
        await pool.query('DELETE FROM heats WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/heats');
    } catch (error) {
        res.status(500).send('Erreur suppression.');
    }
};