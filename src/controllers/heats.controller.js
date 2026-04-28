const { pool } = require('../db');

exports.listHeats = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        const result = await pool.query(`
            SELECT h.*, d.name AS dog_name
            FROM heats h
            JOIN dogs d ON h.dog_id = d.id
            WHERE h.breeder_id = $1
            ORDER BY h.start_date DESC
        `, [breederId]);

        res.render('heats/index', { heats: result.rows });
    } catch (error) {
        console.error('Erreur liste chaleurs:', error);
        res.status(500).send('Erreur lors du chargement du module des chaleurs.');
    }
};

exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        const females = await pool.query(`
            SELECT id, name FROM dogs 
            WHERE breeder_id = $1 AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('heats/new', { females: females.rows });
    } catch (error) {
        console.error('Erreur formulaire chaleurs:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.createHeat = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        let { dog_id, start_date, end_date, stage, notes } = req.body;

        // MACHINE À ÉTATS : Calcul automatique de la fin des chaleurs (+21 jours)
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
        console.error('Erreur création chaleur:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const heatId = req.params.id;

        const heatResult = await pool.query('SELECT * FROM heats WHERE id = $1 AND breeder_id = $2', [heatId, breederId]);
        
        if (heatResult.rows.length === 0) {
            return res.status(404).send('Enregistrement introuvable.');
        }

        const females = await pool.query(`
            SELECT id, name FROM dogs 
            WHERE breeder_id = $1 AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('heats/edit', { 
            heat: heatResult.rows[0],
            females: females.rows 
        });
    } catch (error) {
        console.error('Erreur édition chaleur:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.updateHeat = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const heatId = req.params.id;
        let { dog_id, start_date, end_date, stage, notes } = req.body;

        // MACHINE À ÉTATS : Recalcul si l'utilisateur vide le champ de date de fin
        if (start_date && !end_date) {
            let startDateObj = new Date(start_date);
            startDateObj.setDate(startDateObj.getDate() + 21);
            end_date = startDateObj.toISOString().split('T')[0];
        }

        await pool.query(`
            UPDATE heats 
            SET dog_id = $1, start_date = $2, end_date = $3, stage = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND breeder_id = $7
        `, [dog_id, start_date, end_date || null, stage, notes, heatId, breederId]);

        res.redirect('/heats');
    } catch (error) {
        console.error('Erreur mise à jour chaleur:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.deleteHeat = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const heatId = req.params.id;

        await pool.query('DELETE FROM heats WHERE id = $1 AND breeder_id = $2', [heatId, breederId]);
        res.redirect('/heats');
    } catch (error) {
        console.error('Erreur suppression chaleur:', error);
        res.status(500).send('Erreur lors de la suppression.');
    }
};