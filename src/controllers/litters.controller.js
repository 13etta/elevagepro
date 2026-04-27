const { pool } = require('../db');

exports.listLitters = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, status, female_id } = req.query;

        let query = `
            SELECT l.*, d.name AS mother_name 
            FROM litters l
            LEFT JOIN dogs d ON l.mother_id = d.id
            WHERE l.breeder_id = $1
        `;
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (l.notes ILIKE $${params.length} OR d.name ILIKE $${params.length})`;
        }
        if (status) {
            params.push(status);
            query += ` AND l.status = $${params.length}`;
        }
        if (female_id) {
            params.push(female_id);
            query += ` AND l.mother_id = $${params.length}`;
        }

        query += ' ORDER BY l.birth_date DESC';
        const result = await pool.query(query, params);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        res.render('litters/index', { litters: result.rows, females: females.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste portées:', error);
        res.status(500).send('Erreur lors du chargement des portées.');
    }
};

exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status = 'Actif' ORDER BY name ASC", [breederId]);
        const matings = await pool.query(`
            SELECT m.id, m.mating_date, d1.name AS male_name, d2.name AS female_name
            FROM matings m JOIN dogs d1 ON m.male_id = d1.id JOIN dogs d2 ON m.female_id = d2.id
            WHERE m.breeder_id = $1 ORDER BY m.mating_date DESC
        `, [breederId]);

        res.render('litters/new', { females: females.rows, matings: matings.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.createLitter = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { mother_id, mating_id, birth_date, puppies_count_total, status, notes } = req.body;

        const result = await pool.query(`
            INSERT INTO litters (breeder_id, mother_id, mating_id, birth_date, puppies_count_total, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [breederId, mother_id, mating_id || null, birth_date, puppies_count_total || 0, status || 'active', notes]);

        res.redirect(`/litters/${result.rows[0].id}`);
    } catch (error) {
        console.error('Erreur création portée:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;

        const litterRes = await pool.query('SELECT * FROM litters WHERE id = $1 AND breeder_id = $2', [litterId, breederId]);
        if (litterRes.rows.length === 0) return res.status(404).send('Portée introuvable.');

        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F'", [breederId]);
        const matings = await pool.query(`
            SELECT m.id, m.mating_date, d1.name AS male_name, d2.name AS female_name
            FROM matings m JOIN dogs d1 ON m.male_id = d1.id JOIN dogs d2 ON m.female_id = d2.id
            WHERE m.breeder_id = $1 ORDER BY m.mating_date DESC
        `, [breederId]);

        res.render('litters/edit', { litter: litterRes.rows[0], females: females.rows, matings: matings.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.updateLitter = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        const { mother_id, mating_id, birth_date, puppies_count_total, status, notes } = req.body;

        // On utilise UPDATE avec une condition stricte sur l'ID de la portée et de l'éleveur
        await pool.query(`
            UPDATE litters 
            SET mother_id = $1, mating_id = $2, birth_date = $3, puppies_count_total = $4, status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND breeder_id = $8
        `, [mother_id, mating_id || null, birth_date, puppies_count_total || 0, status, notes, litterId, breederId]);

        res.redirect('/litters');
    } catch (error) {
        console.error('Erreur mise à jour portée:', error);
        res.status(500).send('Erreur lors de la sauvegarde des modifications.');
    }
};

exports.deleteLitter = async (req, res) => {
    try {
        await pool.query('DELETE FROM litters WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/litters');
    } catch (error) {
        res.status(500).send('Erreur suppression.');
    }
};

exports.showLitter = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;

        const litterRes = await pool.query(`
            SELECT l.*, d.name AS mother_name 
            FROM litters l 
            LEFT JOIN dogs d ON l.mother_id = d.id 
            WHERE l.id = $1 AND l.breeder_id = $2
        `, [litterId, breederId]);

        if (litterRes.rows.length === 0) return res.status(404).send('Portée introuvable.');

        const puppiesRes = await pool.query('SELECT * FROM puppies WHERE litter_id = $1 ORDER BY created_at ASC', [litterId]);

        res.render('litters/show', { litter: litterRes.rows[0], puppies: puppiesRes.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};