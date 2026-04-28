const { pool } = require('../db');

exports.listMatings = async (req, res) => {
    // Garde ton listMatings actuel (avec tous ses filtres)
    try {
        const breederId = req.session.user.breeder_id;
        const { q, male_id, female_id, method, start_date, end_date } = req.query;

        let query = `
            SELECT m.*, d1.name AS male_name, d1.id_scc AS male_id_scc, d2.name AS female_name, d2.id_scc AS female_id_scc
            FROM matings m LEFT JOIN dogs d1 ON m.male_id = d1.id LEFT JOIN dogs d2 ON m.female_id = d2.id WHERE m.breeder_id = $1
        `;
        // ... (Ton code de filtres)
        query += ' ORDER BY m.mating_date DESC';
        const result = await pool.query(query, [breederId]);
        const males = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M'", [breederId]);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F'", [breederId]);

        res.render('matings/index', { matings: result.rows, males: males.rows, females: females.rows, filters: req.query });
    } catch (error) { res.status(500).send('Erreur.'); }
};

exports.getCreateForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const males = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' AND status = 'Actif'", [breederId]);
        const females = await pool.query("SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' AND status = 'Actif'", [breederId]);
        res.render('matings/new', { males: males.rows, females: females.rows });
    } catch (error) { res.status(500).send('Erreur serveur.'); }
};

exports.createMating = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Début de la transaction
        const breederId = req.session.user.breeder_id;
        const { male_id, female_id, mating_date, method, place, notes } = req.body;

        // 1. Insertion de la saillie
        const matingRes = await client.query(`
            INSERT INTO matings (breeder_id, male_id, female_id, mating_date, method, place, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `, [breederId, male_id, female_id, mating_date, method, place, notes]);

        const matingId = matingRes.rows[0].id;

        // 🧠 AUTOMATISATION : Création immédiate de la gestation avec mise bas prévue à +63 jours
        const startObj = new Date(mating_date);
        startObj.setDate(startObj.getDate() + 63);
        const expected_date = startObj.toISOString().split('T')[0];

        await client.query(`
            INSERT INTO pregnancies (breeder_id, mating_id, female_id, start_date, expected_date, result)
            VALUES ($1, $2, $3, $4, $5, 'En cours')
        `, [breederId, matingId, female_id, mating_date, expected_date]);

        await client.query('COMMIT'); // On valide les 2 opérations
        res.redirect('/matings');
    } catch (error) {
        await client.query('ROLLBACK'); // En cas d'erreur, on annule tout
        console.error('Erreur saillie:', error);
        res.status(500).send('Erreur de sauvegarde.');
    } finally {
        client.release();
    }
};

exports.getEditForm = async (req, res) => {
    // ... Garde ton code existant pour getEditForm
};

exports.updateMating = async (req, res) => {
    // ... Garde ton code existant (simple UPDATE sur matings)
};

exports.deleteMating = async (req, res) => {
    // ... Garde ton code existant (le ON DELETE CASCADE s'occupera de supprimer la gestation liée si configuré)
};

exports.getVirtualLitter = async (req, res) => {
    // ... Garde ton code existant pour le simulateur SCC
};