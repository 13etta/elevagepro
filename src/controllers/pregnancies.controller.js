const { pool } = require('../db');

exports.listPregnancies = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, female, status } = req.query;

        // CORRECTION 1 : Jointures en cascade pour récupérer le mâle via la saillie (mating)
        let query = `
            SELECT 
                p.*, 
                f.name AS female_name,
                m.mating_date,
                father.name AS father_name
            FROM pregnancies p
            LEFT JOIN dogs f ON p.female_id = f.id
            LEFT JOIN matings m ON p.mating_id = m.id
            LEFT JOIN dogs father ON m.male_id = father.id
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
        
        // CORRECTION 2 : Élargissement du filtre des statuts pour inclure les chiennes en processus de reproduction
        const females = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 
              AND sex = 'F' 
              AND LOWER(status) IN ('actif', 'active', 'en saillie', 'gestante', 'en gestation')
            ORDER BY name ASC
        `, [breederId]);

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
        let pregnancy = { result: 'En cours' };

        if (pregId) {
            const pregRes = await pool.query('SELECT * FROM pregnancies WHERE id = $1 AND breeder_id = $2', [pregId, breederId]);
            if (pregRes.rows.length > 0) pregnancy = pregRes.rows[0];
        }

        // Le même filtre élargi pour le formulaire de création/modification
        const females = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 
              AND sex = 'F' 
              AND LOWER(status) IN ('actif', 'active', 'en saillie', 'gestante', 'en gestation')
            ORDER BY name ASC
        `, [breederId]);
        
        const matings = await pool.query(`
            SELECT m.id, m.mating_date, f.name as female_name, male.name as male_name
            FROM matings m
            JOIN dogs f ON m.female_id = f.id
            JOIN dogs male ON m.male_id = male.id
            WHERE m.breeder_id = $1
            ORDER BY m.mating_date DESC
        `, [breederId]);

        res.render('pregnancies/form', { pregnancy, females: females.rows, matings: matings.rows });
    } catch (error) {
        console.error('Erreur form gestation:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.savePregnancy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const pregId = req.params.id;
        let { mating_id, female_id, start_date, expected_date, due_date, result, notes } = req.body;

        if (!female_id || !start_date) {
            return res.status(400).send('La femelle et la date de début sont obligatoires.');
        }

        if (expected_date && typeof expected_date === 'string' && expected_date.includes('T')) {
            expected_date = expected_date.split('T')[0];
        }

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
            
            // AUTOMATISATION : On passe la chienne en statut Gestante automatiquement
            await pool.query("UPDATE dogs SET status = 'Gestante' WHERE id = $1 AND breeder_id = $2", [female_id, breederId]);
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
    // --- ALIAS POUR LA COMPATIBILITÉ AVEC LE ROUTEUR ---
if (typeof exports.getCreateForm === 'undefined') exports.getCreateForm = exports.getForm;
if (typeof exports.getEditForm === 'undefined') exports.getEditForm = exports.getForm;
if (typeof exports.createPregnancy === 'undefined') exports.createPregnancy = exports.savePregnancy;
if (typeof exports.updatePregnancy === 'undefined') exports.updatePregnancy = exports.savePregnancy;
if (typeof exports.showPregnancy === 'undefined') exports.showPregnancy = exports.getForm; // Au cas où une route de vue existerait
};