const { pool } = require('../db');
const { createPuppyProtocolReminders } = require('../services/protocols.service');
const { assertIsoDate } = require('../utils/dates');
const { logActivity } = require('../services/activity.service');

function setFlash(req, type, message) {
    req.session.flash = { type, message };
}

exports.listLitters = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, status, female_id } = req.query;

        let query = `
            SELECT 
                l.*, 
                mother.name AS mother_name,
                father.name AS father_name,
                COUNT(p.id)::int AS created_puppies_count,
                COUNT(s.id)::int AS sales_count
            FROM litters l
            LEFT JOIN dogs mother ON l.mother_id = mother.id
            LEFT JOIN matings m ON l.mating_id = m.id
            LEFT JOIN dogs father ON m.male_id = father.id
            LEFT JOIN puppies p ON p.litter_id = l.id
            LEFT JOIN sales s ON s.puppy_id = p.id
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

        query += ' GROUP BY l.id, mother.name, father.name ORDER BY l.birth_date DESC';
        const result = await pool.query(query, params);
        
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
        setFlash(req, 'error', 'Erreur lors du chargement des portées.');
        res.redirect('/dashboard');
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

        const viewTemplate = litterId ? 'litters/edit' : 'litters/new';
        res.render(viewTemplate, { litter, females: females.rows, matings: matings.rows });
    } catch (error) {
        console.error('Erreur form portée:', error);
        setFlash(req, 'error', 'Erreur lors du chargement du formulaire de portée.');
        res.redirect('/litters');
    }
};

exports.saveLitter = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        const { mother_id, mating_id, puppies_count_total, status, notes } = req.body;
        const birthDate = assertIsoDate(req.body.birth_date, 'date de mise bas');
        const puppiesCount = Number.parseInt(puppies_count_total || '0', 10);

        if (!mother_id || !birthDate) {
            setFlash(req, 'error', 'La mère et la date de naissance sont obligatoires.');
            return res.redirect(litterId ? `/litters/${litterId}/edit` : '/litters/new');
        }

        if (!Number.isInteger(puppiesCount) || puppiesCount < 0) {
            setFlash(req, 'error', 'Le nombre de chiots doit être un entier positif ou nul.');
            return res.redirect(litterId ? `/litters/${litterId}/edit` : '/litters/new');
        }

        await client.query('BEGIN');

        if (litterId) {
            await client.query(`
                UPDATE litters 
                SET mother_id = $1, mating_id = $2, birth_date = $3, puppies_count_total = $4, status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
                WHERE id = $7 AND breeder_id = $8
            `, [mother_id, mating_id || null, birthDate, puppiesCount, status || 'active', notes, litterId, breederId]);
            await logActivity(client, { breederId, userId: req.session.user.id, action: 'litter.updated', entityType: 'litter', entityId: litterId, label: 'Portée modifiée' });
        } else {
            const inserted = await client.query(`
                INSERT INTO litters (breeder_id, mother_id, mating_id, birth_date, puppies_count_total, status, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
            `, [breederId, mother_id, mating_id || null, birthDate, puppiesCount, status || 'active', notes]);
            
            await client.query("UPDATE dogs SET status = 'Maternité' WHERE id = $1 AND breeder_id = $2", [mother_id, breederId]);

            if (typeof createPuppyProtocolReminders === 'function') {
                await createPuppyProtocolReminders(client, breederId, inserted.rows[0].id, birthDate);
            }
            await logActivity(client, { breederId, userId: req.session.user.id, action: 'litter.created', entityType: 'litter', entityId: inserted.rows[0].id, label: 'Portée créée', metadata: { puppiesCount, birthDate } });
        }

        await client.query('COMMIT');
        setFlash(req, 'success', 'Portée enregistrée avec succès.');
        res.redirect('/litters');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur sauvegarde portée:', error);
        setFlash(req, 'error', error.message || 'Erreur lors de la sauvegarde des modifications.');
        res.redirect('/litters');
    } finally {
        client.release();
    }
};

exports.deleteLitter = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        const linked = await pool.query(`
            SELECT
              COUNT(p.id)::int AS puppies_count,
              COUNT(s.id)::int AS sales_count,
              COUNT(so.id)::int AS soins_count
            FROM litters l
            LEFT JOIN puppies p ON p.litter_id = l.id
            LEFT JOIN sales s ON s.puppy_id = p.id
            LEFT JOIN soins so ON so.puppy_id = p.id
            WHERE l.id = $1 AND l.breeder_id = $2
        `, [litterId, breederId]);

        const row = linked.rows[0] || {};
        if ((row.sales_count || 0) > 0 || (row.soins_count || 0) > 0) {
            setFlash(req, 'error', 'Suppression refusée : cette portée contient des chiots liés à une vente ou à un soin.');
            return res.redirect('/litters');
        }

        await pool.query('DELETE FROM litters WHERE id = $1 AND breeder_id = $2', [litterId, breederId]);
        await logActivity(pool, { breederId, userId: req.session.user.id, action: 'litter.deleted', entityType: 'litter', entityId: litterId, label: 'Portée supprimée' });
        setFlash(req, 'success', 'Portée supprimée avec succès.');
        res.redirect('/litters');
    } catch (error) {
        console.error('Erreur suppression portée:', error);
        setFlash(req, 'error', 'Erreur suppression.');
        res.redirect('/litters');
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

        const puppiesRes = await pool.query('SELECT * FROM puppies WHERE litter_id = $1 AND breeder_id = $2 ORDER BY created_at ASC', [litterId, breederId]);
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

exports.getCreateForm = exports.getForm;
exports.getEditForm = exports.getForm;
exports.createLitter = exports.saveLitter;
exports.updateLitter = exports.saveLitter;
