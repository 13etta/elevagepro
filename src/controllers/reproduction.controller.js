const { pool } = require('../db');

function addDays(dateValue, days) {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

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

        const echoDate = addDays(mating_date, 25);

        await client.query(`
            INSERT INTO reminders (breeder_id, dog_id, type, title, due_date)
            VALUES ($1, $2, 'reproduction', 'Échographie de confirmation de gestation', $3)
        `, [breederId, female_id, echoDate]);

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

exports.confirmMating = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const matingId = req.params.id;

        await client.query('BEGIN');

        const matingResult = await client.query(`
            SELECT id, female_id, mating_date
            FROM matings
            WHERE id = $1 AND breeder_id = $2
            LIMIT 1
        `, [matingId, breederId]);

        const mating = matingResult.rows[0];
        if (!mating) {
            await client.query('ROLLBACK');
            return res.status(404).send('Saillie introuvable.');
        }

        const existingPregnancy = await client.query(`
            SELECT id
            FROM pregnancies
            WHERE mating_id = $1 AND breeder_id = $2
            LIMIT 1
        `, [matingId, breederId]);

        if (!existingPregnancy.rows.length) {
            const expectedDate = addDays(mating.mating_date, 63);
            await client.query(`
                INSERT INTO pregnancies (
                    breeder_id,
                    mating_id,
                    dog_id,
                    female_id,
                    confirmation_date,
                    start_date,
                    expected_delivery_date,
                    expected_date,
                    status,
                    result,
                    notes
                )
                VALUES ($1, $2, $3, $3, CURRENT_DATE, $4, $5, $5, 'en_cours', 'En cours', $6)
            `, [
                breederId,
                matingId,
                mating.female_id,
                mating.mating_date,
                expectedDate,
                'Gestation confirmée depuis le pipeline reproduction.',
            ]);

            await client.query(`
                UPDATE dogs
                SET status = 'Gestante', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND breeder_id = $2
            `, [mating.female_id, breederId]).catch(() => {});

            await client.query(`
                INSERT INTO reminders (breeder_id, dog_id, type, title, due_date)
                VALUES
                  ($1, $2, 'reproduction', 'Préparer la caisse de mise bas', $3),
                  ($1, $2, 'reproduction', 'Surveillance mise bas estimée', $4)
            `, [
                breederId,
                mating.female_id,
                addDays(expectedDate, -7),
                expectedDate,
            ]).catch(() => {});
        }

        await client.query('COMMIT');
        return res.redirect('/reproduction');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur confirmation gestation:', error);
        return res.status(500).send('Erreur lors de la confirmation de gestation.');
    } finally {
        client.release();
    }
};

exports.markMatingFailed = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const matingId = req.params.id;

        await client.query('BEGIN');

        const matingResult = await client.query(`
            SELECT id, female_id, mating_date
            FROM matings
            WHERE id = $1 AND breeder_id = $2
            LIMIT 1
        `, [matingId, breederId]);

        const mating = matingResult.rows[0];
        if (!mating) {
            await client.query('ROLLBACK');
            return res.status(404).send('Saillie introuvable.');
        }

        await client.query(`
            INSERT INTO pregnancies (
                breeder_id,
                mating_id,
                dog_id,
                female_id,
                confirmation_date,
                start_date,
                expected_delivery_date,
                expected_date,
                status,
                result,
                notes
            )
            VALUES ($1, $2, $3, $3, CURRENT_DATE, $4, NULL, NULL, 'echec', 'Échec', $5)
            ON CONFLICT DO NOTHING
        `, [
            breederId,
            matingId,
            mating.female_id,
            mating.mating_date,
            'Saillie marquée non concluante depuis le pipeline reproduction.',
        ]).catch(async () => {
            await client.query(`
                INSERT INTO pregnancies (
                    breeder_id,
                    mating_id,
                    dog_id,
                    female_id,
                    confirmation_date,
                    start_date,
                    status,
                    result,
                    notes
                )
                SELECT $1, $2, $3, $3, CURRENT_DATE, $4, 'echec', 'Échec', $5
                WHERE NOT EXISTS (
                    SELECT 1 FROM pregnancies WHERE breeder_id = $1 AND mating_id = $2
                )
            `, [
                breederId,
                matingId,
                mating.female_id,
                mating.mating_date,
                'Saillie marquée non concluante depuis le pipeline reproduction.',
            ]);
        });

        await client.query('COMMIT');
        return res.redirect('/reproduction');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur échec saillie:', error);
        return res.status(500).send('Erreur lors du classement de la saillie.');
    } finally {
        client.release();
    }
};