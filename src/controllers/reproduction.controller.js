const { pool } = require('../db');

exports.getIndex = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // 1. Récupération des chaleurs récentes
        const heats = await pool.query(`
            SELECT h.start_date, h.stage, d.name AS dog_name
            FROM heats h JOIN dogs d ON h.dog_id = d.id
            WHERE h.breeder_id = $1 ORDER BY h.start_date DESC LIMIT 5
        `, [breederId]);

        // 2. Récupération des saillies sans gestation associée
        const matings = await pool.query(`
            SELECT m.id, m.mating_date, m.method, f.name AS female_name, ma.name AS male_name
            FROM matings m
            JOIN dogs f ON m.female_id = f.id
            JOIN dogs ma ON m.male_id = ma.id
            LEFT JOIN pregnancies p ON p.mating_id = m.id
            WHERE m.breeder_id = $1 AND p.id IS NULL
            ORDER BY m.mating_date DESC
        `, [breederId]);

      // 3. Récupération des gestations en cours
        const pregnancies = await pool.query(`
            SELECT p.expected_date AS expected_delivery_date, p.result AS status, f.name AS female_name
            FROM pregnancies p 
            JOIN dogs f ON p.female_id = f.id
            WHERE p.breeder_id = $1 AND p.result = 'En cours'
            ORDER BY p.expected_date ASC
        `, [breederId]);

        // 4. Listes déroulantes : Application du filtre de sécurité d'élevage
        const females = await pool.query(`
            SELECT id, name FROM dogs 
            WHERE breeder_id = $1 AND sex = 'F' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        const males = await pool.query(`
            SELECT id, name FROM dogs 
            WHERE breeder_id = $1 AND sex = 'M' 
            AND status NOT IN ('Réforme', 'Retraite', 'Placé', 'Décédé', 'Vendu')
            ORDER BY name ASC
        `, [breederId]);

        res.render('reproduction/index', {
            heats: heats.rows,
            matings: matings.rows,
            pregnancies: pregnancies.rows,
            females: females.rows,
            males: males.rows
        });
    } catch (error) {
        console.error('Erreur reproduction:', error);
        res.status(500).send("Erreur lors du chargement du module de reproduction.");
    }
};

exports.addMating = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { female_id, male_id, mating_date, method } = req.body;

        await client.query('BEGIN');

        // 1. Création de la saillie
        await client.query(`
            INSERT INTO matings (breeder_id, female_id, male_id, mating_date, method)
            VALUES ($1, $2, $3, $4, $5)
        `, [breederId, female_id, male_id, mating_date, method]);

        // 2. Calcul automatique : Échographie recommandée à +25 jours
        const matingDateObj = new Date(mating_date);
        const echoDate = new Date(matingDateObj);
        echoDate.setDate(echoDate.getDate() + 25);

        // 3. Création automatique du rappel pour l'échographie
        await client.query(`
            INSERT INTO reminders (breeder_id, dog_id, type, title, due_date)
            VALUES ($1, $2, 'reproduction', 'Échographie de confirmation de gestation', $3)
        `, [breederId, female_id, echoDate.toISOString().split('T')[0]]);

        await client.query('COMMIT');
        res.redirect('/reproduction');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur création saillie:', error);
        // Correction ici : utilisation des doubles guillemets
        res.status(500).send("Erreur lors de l'enregistrement de la saillie.");
    } finally {
        client.release();
    }
};