const { pool } = require('../db');
const registerService = require('../services/register.service'); // NOUVEAU : Import du service de registre

async function columnExists(tableName, columnName) {
    const result = await pool.query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                  AND column_name = $2
            ) AS exists
        `,
        [tableName, columnName],
    );

    return Boolean(result.rows[0]?.exists);
}

async function getLitterMotherColumn() {
    if (await columnExists('litters', 'mother_id')) return 'mother_id';
    if (await columnExists('litters', 'female_id')) return 'female_id';
    return null;
}

async function getLitterCountExpression() {
    if (await columnExists('litters', 'puppies_count_total')) return 'puppies_count_total';
    if (await columnExists('litters', 'puppies_count')) return 'puppies_count';
    if (await columnExists('litters', 'nb_puppies')) return 'nb_puppies';
    return 'NULL';
}

exports.listDogs = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const result = await pool.query('SELECT * FROM dogs WHERE breeder_id = $1 ORDER BY name ASC', [breederId]);
        res.render('dogs/index', { dogs: result.rows });
    } catch (error) {
        console.error('Erreur chargement chiens:', error);
        res.status(500).send('Erreur chargement.');
    }
};

exports.showDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        const dogRes = await pool.query(
            `
                SELECT
                    d.*,
                    father.name AS father_name,
                    mother.name AS mother_name
                FROM dogs d
                LEFT JOIN dogs father ON d.father_id = father.id
                LEFT JOIN dogs mother ON d.mother_id = mother.id
                WHERE d.id = $1
                  AND d.breeder_id = $2
            `,
            [dogId, breederId],
        );

        if (dogRes.rows.length === 0) {
            return res.status(404).render('errors/404', {
                title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
                user: req.session?.user || null,
            });
        }

        const soins = await pool.query(
            `
                SELECT id, type, label, event_date, next_due, notes
                FROM soins
                WHERE breeder_id = $1
                  AND dog_id = $2
                ORDER BY event_date DESC NULLS LAST
                LIMIT 20
            `,
            [breederId, dogId],
        );

        const hasReminderCompletedColumn = await columnExists('reminders', 'is_completed');
        const reminderCompletedFilter = hasReminderCompletedColumn ? 'AND COALESCE(is_completed, false) = false' : '';
        const reminders = await pool.query(
            `
                SELECT id, title, due_date, type
                FROM reminders
                WHERE breeder_id = $1
                  AND dog_id = $2
                  ${reminderCompletedFilter}
                ORDER BY due_date ASC
                LIMIT 20
            `,
            [breederId, dogId],
        );

        const litterMotherColumn = await getLitterMotherColumn();
        const litterCountExpression = await getLitterCountExpression();

        let litters = { rows: [] };
        let puppies = { rows: [] };

        if (litterMotherColumn) {
            litters = await pool.query(
                `
                    SELECT id, birth_date, ${litterCountExpression} AS puppies_count_total, notes
                    FROM litters
                    WHERE breeder_id = $1
                      AND ${litterMotherColumn} = $2
                    ORDER BY birth_date DESC NULLS LAST
                    LIMIT 20
                `,
                [breederId, dogId],
            );

            puppies = await pool.query(
                `
                    SELECT p.id, p.name, p.sex, p.status, p.chip_number, p.color, p.created_at
                    FROM puppies p
                    INNER JOIN litters l ON p.litter_id = l.id
                    WHERE p.breeder_id = $1
                      AND l.${litterMotherColumn} = $2
                    ORDER BY p.created_at DESC NULLS LAST, p.name ASC NULLS LAST
                    LIMIT 50
                `,
                [breederId, dogId],
            );
        }

        return res.render('dogs/show', {
            dog: dogRes.rows[0],
            soins: soins.rows,
            reminders: reminders.rows,
            litters: litters.rows,
            puppies: puppies.rows,
            user: req.session.user,
        });
    } catch (error) {
        console.error('Erreur fiche chien:', error);
        return res.status(500).send('Erreur lors du chargement de la fiche chien.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        let dog = { status: 'actif' };

        if (dogId) {
            const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
            if (dogRes.rows.length > 0) dog = dogRes.rows[0];
        }

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

        if (father_id) father_name_external = null;
        if (mother_id) mother_name_external = null;

        if (dogId) {
            // 1. MISE À JOUR D'UN CHIEN EXISTANT
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
            // 2. CRÉATION D'UN NOUVEAU CHIEN (Arrivée dans l'élevage)
            await pool.query(`
                INSERT INTO dogs (
                    breeder_id, name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, lof, status, notes,
                    father_id, mother_id, father_name_external, mother_name_external
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `, [breederId, name, sex, breed, birth_date || null, chip_number, id_scc, pedigree_number, lof, status, notes,
                father_id || null, mother_id || null, father_name_external, mother_name_external]);

            // --- DÉBUT AUTOMATISATION DU REGISTRE DDPP ---
            await registerService.logMovement({
                breederId: breederId,
                animalName: name,
                identification: chip_number,
                breed: breed || 'Non renseignée',
                type: 'ENTREE',
                reason: 'Acquisition', // Motif légal pour l'entrée d'un chien adulte
                date: new Date() // Date du jour de l'enregistrement dans le logiciel
            });
            // --- FIN AUTOMATISATION ---
        }
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur sauvegarde chien:', error);
        res.status(500).send('Erreur sauvegarde.');
    }
};

exports.deleteDog = async (req, res) => {
    try {
        await pool.query('DELETE FROM dogs WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur suppression chien:', error);
        res.status(500).send('Erreur suppression.');
    }
};
