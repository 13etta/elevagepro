const { pool } = require('../db');

exports.getIndex = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        const heats = await pool.query(`
            SELECT h.id, h.start_date, h.stage, d.name AS dog_name, d.breed, d.photo_url
            FROM heats h
            JOIN dogs d ON h.dog_id = d.id
            WHERE h.breeder_id = $1
            ORDER BY h.start_date DESC
            LIMIT 20
        `, [breederId]);

        const matings = await pool.query(`
            SELECT
                m.id,
                m.mating_date,
                m.method,
                f.name AS female_name,
                f.breed AS female_breed,
                f.photo_url AS female_photo_url,
                ma.name AS male_name,
                ma.breed AS male_breed,
                ma.photo_url AS male_photo_url
            FROM matings m
            JOIN dogs f ON m.female_id = f.id
            JOIN dogs ma ON m.male_id = ma.id
            LEFT JOIN pregnancies p ON p.mating_id = m.id
            WHERE m.breeder_id = $1
              AND p.id IS NULL
            ORDER BY m.mating_date DESC
            LIMIT 20
        `, [breederId]);

        const pregnancies = await pool.query(`
            SELECT
                p.id,
                p.expected_date AS expected_delivery_date,
                p.result AS status,
                f.name AS female_name,
                f.breed,
                f.photo_url
            FROM pregnancies p
            JOIN dogs f ON p.female_id = f.id
            WHERE p.breeder_id = $1
              AND p.result = 'En cours'
            ORDER BY p.expected_date ASC
            LIMIT 20
        `, [breederId]);

        const females = await pool.query(`
            SELECT id, name
            FROM dogs
            WHERE breeder_id = $1
              AND sex = 'F'
              AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        const males = await pool.query(`
            SELECT id, name
            FROM dogs
            WHERE breeder_id = $1
              AND sex = 'M'
              AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('reproduction/index', {
            heats: heats.rows,
            matings: matings.rows,
            pregnancies: pregnancies.rows,
            females: females.rows,
            males: males.rows,
        });
    } catch (error) {
        console.error('Erreur reproduction:', error);
        res.status(500).send('Erreur lors du chargement du module de reproduction.');
    }
};

exports.addMating = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { female_id, male_id, mating_date, method } = req.body;

        await client.query('BEGIN');

        await client.query(`
            INSERT INTO matings (breeder_id, female_id, male_id, mating_date, method)
            VALUES ($1, $2, $3, $4, $5)
        `, [breederId, female_id, male_id, mating_date, method]);

        const matingDateObj = new Date(mating_date);
        const echoDate = new Date(matingDateObj);
        echoDate.setDate(echoDate.getDate() + 25);

        await client.query(`
            INSERT INTO reminders (breeder_id, dog_id, type, title, due_date)
            VALUES ($1, $2, 'reproduction', 'Échographie de confirmation de gestation', $3)
        `, [breederId, female_id, echoDate.toISOString().split('T')[0]]);

        await client.query('COMMIT');
        res.redirect('/reproduction');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur création saillie:', error);
        res.status(500).send("Erreur lors de l'enregistrement de la saillie.");
    } finally {
        client.release();
    }
};