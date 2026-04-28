const { pool } = require('../db');

// 1. Liste tous les chiens
exports.listDogs = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, sex, status } = req.query;

        let query = 'SELECT * FROM dogs WHERE breeder_id = $1';
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (name ILIKE $${params.length} OR chip_number ILIKE $${params.length})`;
        }
        if (sex) {
            params.push(sex);
            query += ` AND sex = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ' ORDER BY name ASC';
        const result = await pool.query(query, params);

        res.render('dogs/index', { dogs: result.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste chiens:', error);
        res.status(500).send('Erreur lors du chargement des chiens.');
    }
};

exports.showDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        const dogResult = await pool.query(
            `
              SELECT d.*,
                     father.name AS father_name,
                     mother.name AS mother_name
              FROM dogs d
              LEFT JOIN dogs father ON d.father_id = father.id
              LEFT JOIN dogs mother ON d.mother_id = mother.id
              WHERE d.id = $1 AND d.breeder_id = $2
            `,
            [dogId, breederId]
        );

        if (!dogResult.rows.length) {
            return res.status(404).render('errors/404', {
                title: 'Chien introuvable',
                user: req.session.user,
            });
        }

        const soins = await pool.query(
            `
              SELECT id, type, label, event_date, next_due
              FROM soins
              WHERE breeder_id = $1 AND dog_id = $2
              ORDER BY event_date DESC
              LIMIT 10
            `,
            [breederId, dogId]
        );

        const reminders = await pool.query(
            `
              SELECT id, type, title, due_date, is_completed
              FROM reminders
              WHERE breeder_id = $1 AND dog_id = $2 AND is_completed = FALSE
              ORDER BY due_date ASC
              LIMIT 10
            `,
            [breederId, dogId]
        );

        const litters = await pool.query(
            `
              SELECT id, birth_date, puppies_count_total, notes
              FROM litters
              WHERE breeder_id = $1 AND mother_id = $2
              ORDER BY birth_date DESC
            `,
            [breederId, dogId]
        );

        const puppies = await pool.query(
            `
              SELECT p.id, p.name, p.sex, p.color, p.chip_number, p.status, p.sale_price, l.birth_date
              FROM puppies p
              JOIN litters l ON p.litter_id = l.id
              WHERE p.breeder_id = $1 AND l.mother_id = $2
              ORDER BY l.birth_date DESC, p.name ASC NULLS LAST
              LIMIT 20
            `,
            [breederId, dogId]
        );

        res.render('dogs/show', {
            title: dogResult.rows[0].name,
            dog: dogResult.rows[0],
            soins: soins.rows,
            reminders: reminders.rows,
            litters: litters.rows,
            puppies: puppies.rows,
        });
    } catch (error) {
        console.error('Erreur fiche chien:', error);
        res.status(500).send('Erreur lors du chargement de la fiche chien.');
    }
};

// 2. Affiche le formulaire de création
exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        const fathers = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' ORDER BY name ASC", [breederId]);
        const mothers = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ORDER BY name ASC", [breederId]);

        res.render('dogs/new', { fathers: fathers.rows, mothers: mothers.rows });
    } catch (error) {
        console.error('Erreur ouverture formulaire:', error);
        res.status(500).send('Erreur serveur.');
    }
};

// 3. Enregistre un nouveau chien
exports.createDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { name, sex, breed, lof, chip_number, id_scc, birth_date, status, father_id, mother_id, pedigree, notes } = req.body;

        await pool.query(`
            INSERT INTO dogs (
                breeder_id, name, sex, breed, lof, chip_number, id_scc, 
                birth_date, status, father_id, mother_id, pedigree, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
            breederId, name, sex, breed, lof, chip_number, id_scc, 
            birth_date || null, status, father_id || null, mother_id || null, pedigree, notes
        ]);

        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur création chien:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

// 4. Affiche le formulaire d'édition
exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        const dogResult = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
        if (dogResult.rows.length === 0) return res.status(404).send('Chien introuvable.');

        const fathers = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' AND id != $2 ORDER BY name ASC", [breederId, dogId]);
        const mothers = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND id != $2 ORDER BY name ASC", [breederId, dogId]);

        res.render('dogs/edit', { 
            dog: dogResult.rows[0],
            fathers: fathers.rows,
            mothers: mothers.rows
        });
    } catch (error) {
        console.error('Erreur formulaire édition:', error);
        res.status(500).send('Erreur serveur.');
    }
};

// 5. Met à jour un chien existant
exports.updateDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        const { name, sex, breed, lof, chip_number, id_scc, birth_date, status, father_id, mother_id, pedigree, notes } = req.body;

        await pool.query(`
            UPDATE dogs SET 
                name = $1, sex = $2, breed = $3, lof = $4, chip_number = $5, 
                id_scc = $6, birth_date = $7, status = $8, father_id = $9, 
                mother_id = $10, pedigree = $11, notes = $12, updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 AND breeder_id = $14
        `, [
            name, sex, breed, lof, chip_number, id_scc, 
            birth_date || null, status, father_id || null, mother_id || null, pedigree, notes, 
            dogId, breederId
        ]);

        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur mise à jour chien:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

// 6. Supprime un chien
exports.deleteDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        await pool.query('DELETE FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur suppression chien:', error);
        res.status(500).send('Erreur lors de la suppression.');
    }
};