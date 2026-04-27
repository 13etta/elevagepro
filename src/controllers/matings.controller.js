const { pool } = require('../db');

exports.listMatings = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, male_id, female_id, method, start_date, end_date } = req.query;

        let query = `
            SELECT m.*, 
                   d1.name AS male_name, d1.id_scc AS male_id_scc,
                   d2.name AS female_name, d2.id_scc AS female_id_scc
            FROM matings m
            LEFT JOIN dogs d1 ON m.male_id = d1.id
            LEFT JOIN dogs d2 ON m.female_id = d2.id
            WHERE m.breeder_id = $1
        `;
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (d1.name ILIKE $${params.length} OR d2.name ILIKE $${params.length} OR m.notes ILIKE $${params.length})`;
        }
        if (male_id) {
            params.push(male_id);
            query += ` AND m.male_id = $${params.length}`;
        }
        if (female_id) {
            params.push(female_id);
            query += ` AND m.female_id = $${params.length}`;
        }
        if (method) {
            params.push(method);
            query += ` AND m.method = $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            query += ` AND m.mating_date BETWEEN $${params.length - 1} AND $${params.length}`;
        }

        query += ' ORDER BY m.mating_date DESC';
        const result = await pool.query(query, params);

        const males = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' ORDER BY name ASC", [breederId]);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        res.render('matings/index', { matings: result.rows, males: males.rows, females: females.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste saillies:', error);
        res.status(500).send('Erreur lors du chargement des saillies.');
    }
};

exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const males = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu') ORDER BY name ASC", [breederId]);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu') ORDER BY name ASC", [breederId]);
        res.render('matings/new', { males: males.rows, females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.createMating = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { male_id, female_id, mating_date, method, place, notes } = req.body;
        await pool.query(`
            INSERT INTO matings (breeder_id, male_id, female_id, mating_date, method, place, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [breederId, male_id, female_id, mating_date, method, place, notes]);
        res.redirect('/matings');
    } catch (error) {
        console.error('Erreur création saillie:', error);
        res.status(500).send('Erreur de sauvegarde.');
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const matingRes = await pool.query('SELECT * FROM matings WHERE id = $1 AND breeder_id = $2', [req.params.id, breederId]);
        if (matingRes.rows.length === 0) return res.status(404).send('Saillie introuvable.');

        const males = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' ORDER BY name ASC", [breederId]);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        res.render('matings/edit', { mating: matingRes.rows[0], males: males.rows, females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.updateMating = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { male_id, female_id, mating_date, method, place, notes } = req.body;
        await pool.query(`
            UPDATE matings SET male_id = $1, female_id = $2, mating_date = $3, method = $4, place = $5, notes = $6
            WHERE id = $7 AND breeder_id = $8
        `, [male_id, female_id, mating_date, method, place, notes, req.params.id, breederId]);
        res.redirect('/matings');
    } catch (error) {
        res.status(500).send('Erreur de sauvegarde.');
    }
};

exports.deleteMating = async (req, res) => {
    try {
        await pool.query('DELETE FROM matings WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/matings');
    } catch (error) {
        res.status(500).send('Erreur suppression.');
    }
};

// Fonction exclusive pour l'outil de simulation SCC
exports.getVirtualLitter = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { male_id, female_id } = req.query;

        const males = await pool.query("SELECT id, name, id_scc FROM dogs WHERE breeder_id = $1 AND sex = 'M' ORDER BY name ASC", [breederId]);
        const females = await pool.query("SELECT id, name, id_scc FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        let selectedMale = null;
        let selectedFemale = null;

        if (male_id && female_id) {
            selectedMale = males.rows.find(m => m.id === male_id);
            selectedFemale = females.rows.find(f => f.id === female_id);
        }

        res.render('matings/virtual_litter', { 
            males: males.rows, 
            females: females.rows,
            selectedMale,
            selectedFemale
        });
    } catch (error) {
        console.error('Erreur portée virtuelle:', error);
        res.status(500).send('Erreur lors du chargement du module.');
    }
};