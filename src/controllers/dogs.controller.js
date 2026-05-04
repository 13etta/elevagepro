const { pool } = require('../db');

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
        res.status(500).send('Erreur lors du chargement de la liste.');
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
        const dogId = req.params.id;
        
        let dog = { status: 'actif' };

        if (dogId) {
            const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
            if (dogRes.rows.length > 0) dog = dogRes.rows[0];
        }

        // Exclusion du chien lui-même de la liste de ses parents potentiels s'il est en cours de modification
        let excludeCondition = dogId ? `AND id != $2` : '';
        let queryParams = dogId ? [breederId, dogId] : [breederId];

        const males = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' ${excludeCondition} ORDER BY name ASC`, queryParams);
        const females = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ${excludeCondition} ORDER BY name ASC`, queryParams);

        res.render('dogs/form', { dog, males: males.rows, females: females.rows });
    } catch (error) {
        console.error('Erreur formulaire chien:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.saveDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        
        let { 
            name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, lof, status, notes,
            father_id, mother_id, father_name_external, mother_name_external
        } = req.body;

        // Assainissement des données : on écrase le texte si un lien interne est sélectionné
        if (father_id) father_name_external = null;
        if (mother_id) mother_name_external = null;

        if (dogId) {
            await pool.query(`
                UPDATE dogs 
                SET name = $1, sex = $2, breed = $3, birth_date = $4, chip_number = $5, 
                    id_scc = $6, pedigree_number = $7, lof = $8, status = $9, notes = $10,
                    father_id = $11, mother_id = $12, father_name_external = $13, mother_name_external = $14,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $15 AND breeder_id = $16
            `, [name, sex, breed, birth_date || null, chip_number, id_scc, pedigree_number, lof, status, notes, 
                father_id || null, mother_id || null, father_name_external, mother_name_external, dogId, breederId]);
        } else {
            await pool.query(`
                INSERT INTO dogs (
                    breeder_id, name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, lof, status, notes,
                    father_id, mother_id, father_name_external, mother_name_external
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `, [breederId, name, sex, breed, birth_date || null, chip_number, id_scc, pedigree_number, lof, status, notes,
                father_id || null, mother_id || null, father_name_external, mother_name_external]);
        }

        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur sauvegarde chien:', error);
        res.status(500).send('Erreur lors de la sauvegarde du profil.');
    }
};

exports.deleteDog = async (req, res) => {
    try {
        await pool.query('DELETE FROM dogs WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur suppression chien:', error);
        res.status(500).send('Erreur lors de la suppression.');
    }
};