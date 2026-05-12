const { pool } = require('../db');
const { createPuppyProtocolReminders, ensureAutomationColumns } = require('../services/protocols.service');

exports.listLitters = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, status, female_id } = req.query;

        // Jointures en cascade pour récupérer le père (via matings)
        let query = `
            SELECT 
                l.*, 
                mother.name AS mother_name,
                father.name AS father_name
            FROM litters l
            LEFT JOIN dogs mother ON l.mother_id = mother.id
            LEFT JOIN matings m ON l.mating_id = m.id
            LEFT JOIN dogs father ON m.male_id = father.id
            WHERE l.breeder_id = $1
        `;
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (l.notes ILIKE $${params.length} OR mother.name ILIKE $${params.length})`;
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
        
        // Filtre élargi
        const females = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 
              AND sex = 'F' 
              AND LOWER(status) IN ('actif', 'active', 'gestante', 'en gestation', 'maternité', 'allaitante')
            ORDER BY name ASC
        `, [breederId]);

        res.render('litters/index', { litters: result.rows, females: females.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste portées:', error);
        res.status(500).send('Erreur lors du chargement des portées.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        let litter = { status: 'active', puppies_count_total: 0 };

        if (litterId) {
            const litterRes = await pool.query('SELECT * FROM litters WHERE id = $1 AND breeder_id = $2', [litterId, breederId]);
            if (litterRes.rows.length > 0) litter = litterRes.rows[0];
        }

        const females = await pool.query(`
            SELECT id, name 
            FROM dogs 
            WHERE breeder_id = $1 
              AND sex = 'F' 
              AND LOWER(status) IN ('actif', 'active', 'gestante', 'en gestation', 'maternité', 'allaitante')
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

        // CORRECTION VUE : Aiguillage dynamique vers new.ejs ou edit.ejs
        const viewTemplate = litterId ? 'litters/edit' : 'litters/new';
        res.render(viewTemplate, { litter, females: females.rows, matings: matings.rows });
    } catch (error) {
        console.error('Erreur form portée:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.saveLitter = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        const { mother_id, mating_id, birth_date, puppies_count_total, status, notes } = req.body;

        if (!mother_id || !birth_date) {
            return res.status(400).send('La mère et la date de naissance sont obligatoires.');
        }

        await client.query('BEGIN');

        if (litterId) {
            await client.query(`
                UPDATE litters 
                SET mother_id = $1, mating_id = $2, birth_date = $3, puppies_count_total = $4, status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
                WHERE id = $7 AND breeder_id = $8
            `, [mother_id, mating_id || null, birth_date, puppies_count_total || 0, status || 'active', notes, litterId, breederId]);
        } else {
            if (typeof ensureAutomationColumns === 'function') await ensureAutomationColumns(client);
            const inserted = await client.query(`
                INSERT INTO litters (breeder_id, mother_id, mating_id, birth_date, puppies_count_total, status, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
            `, [breederId, mother_id, mating_id || null, birth_date, puppies_count_total || 0, status || 'active', notes]);
            
            // Automatisation statut
            await client.query("UPDATE dogs SET status = 'Maternité' WHERE id = $1 AND breeder_id = $2", [mother_id, breederId]);

            if (typeof createPuppyProtocolReminders === 'function') {
                await createPuppyProtocolReminders(client, breederId, inserted.rows[0].id, birth_date);
            }
        }

        await client.query('COMMIT');
        res.redirect('/litters');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur sauvegarde portée:', error);
        res.status(500).send('Erreur lors de la sauvegarde des modifications.');
    } finally {
        client.release();
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
        const remindersRes = await pool.query(`
            SELECT * FROM reminders
            WHERE breeder_id = $1 AND litter_id = $2 AND is_completed = FALSE
            ORDER BY due_date ASC
        `, [breederId, litterId]).catch(() => ({ rows: [] }));

        res.render('litters/show', { 
            title: 'Détails de la portée',
            litter: litterRes.rows[0], 
            puppies: puppiesRes.rows, 
            reminders: remindersRes.rows 
        });
    } catch (error) {
        console.error('Erreur showLitter:', error);
        res.status(500).send('Erreur chargement.');
    }
};

// --- ALIAS SÉCURISÉS POUR ROUTEUR ---
exports.getCreateForm = exports.getForm;
exports.getEditForm = exports.getForm;
exports.createLitter = exports.saveLitter;
exports.updateLitter = exports.saveLitter;