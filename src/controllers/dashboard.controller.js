const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
    try {
        // Sécurité absolue : on récupère l'ID de l'éleveur depuis la session active
        const breederId = req.session.user.breeder_id;

        // 1. Calcul des KPIs (Indicateurs clés)
        const activeDogs = await pool.query(`SELECT count(*) FROM dogs WHERE breeder_id = $1 AND status = 'actif'`, [breederId]);
        const availablePuppies = await pool.query(`SELECT count(*) FROM puppies WHERE breeder_id = $1 AND status = 'disponible'`, [breederId]);
        const activeLitters = await pool.query(`SELECT count(*) FROM litters WHERE breeder_id = $1`, [breederId]);
        const ongoingPregnancies = await pool.query(`SELECT count(*) FROM pregnancies WHERE breeder_id = $1 AND status = 'en_cours'`, [breederId]);

        const kpis = {
            activeDogs: activeDogs.rows[0].count,
            availablePuppies: availablePuppies.rows[0].count,
            activeLitters: activeLitters.rows[0].count,
            ongoingPregnancies: ongoingPregnancies.rows[0].count
        };

        // 2. Récupération des rappels (avec jointure pour le nom du chien et alias pour la vue)
        const remindersRes = await pool.query(`
            SELECT r.due_date, r.title AS label, d.name AS dog_name
            FROM reminders r
            LEFT JOIN dogs d ON r.dog_id = d.id
            WHERE r.breeder_id = $1 AND r.is_completed = FALSE
            ORDER BY r.due_date ASC
            LIMIT 5
        `, [breederId]);

        // 3. Récupération des soins récents
        const soinsRes = await pool.query(`
            SELECT s.event_date, s.type, s.label, d.name AS dog_name
            FROM soins s
            LEFT JOIN dogs d ON s.dog_id = d.id
            WHERE s.breeder_id = $1
            ORDER BY s.event_date DESC
            LIMIT 5
        `, [breederId]);

        // 4. Récupération des ventes (avec adaptation des noms de colonnes pour l'EJS)
        const salesRes = await pool.query(`
            SELECT sale_date, buyer_name AS buyer_firstname, price AS total_price
            FROM sales
            WHERE breeder_id = $1
            ORDER BY sale_date DESC
            LIMIT 5
        `, [breederId]);

        // 5. Fonction utilitaire de formatage de date passée directement à la vue
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('fr-FR');
        };

        // Envoi des données formatées à la vue 'dashboard.ejs'
        res.render('dashboard', {
            kpis,
            reminders: remindersRes.rows,
            soins: soinsRes.rows,
            sales: salesRes.rows,
            formatDate,
            user: req.session.user // On passe l'utilisateur pour l'affichage éventuel du nom
        });

    } catch (error) {
        console.error('Erreur lors du chargement du Dashboard:', error);
        res.status(500).send('Erreur serveur lors de la génération du tableau de bord.');
    }
};