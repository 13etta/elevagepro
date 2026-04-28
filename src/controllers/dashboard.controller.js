const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // 1. Calcul des KPIs avec la bonne casse et les bonnes conditions
        const activeDogs = await pool.query(`SELECT count(*) FROM dogs WHERE breeder_id = $1 AND status = 'Actif'`, [breederId]);
        
        // J'utilise ILIKE pour que 'disponible' ou 'Disponible' soient tous les deux comptés
        const availablePuppies = await pool.query(`SELECT count(*) FROM puppies WHERE breeder_id = $1 AND status ILIKE 'disponible'`, [breederId]);
        
        // Correction du KPI : on ne compte que les portées nécessitant une action
        const activeLitters = await pool.query(`SELECT count(*) FROM litters WHERE breeder_id = $1 AND status IN ('active', 'sevrage')`, [breederId]);
        const ongoingPregnancies = await pool.query(`SELECT count(*) FROM pregnancies WHERE breeder_id = $1 AND result = 'En cours'`, [breederId]);

        const kpis = {
            activeDogs: activeDogs.rows[0].count,
            availablePuppies: availablePuppies.rows[0].count,
            activeLitters: activeLitters.rows[0].count,
            ongoingPregnancies: ongoingPregnancies.rows[0].count
        };

        // 2. Récupération des rappels
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

        // 4. Récupération des ventes
        const salesRes = await pool.query(`
            SELECT sale_date, buyer_name AS buyer_firstname, price AS total_price
            FROM sales
            WHERE breeder_id = $1
            ORDER BY sale_date DESC
            LIMIT 5
        `, [breederId]);

        // 5. Utilitaire de formatage
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('fr-FR');
        };

        res.render('dashboard', {
            kpis,
            reminders: remindersRes.rows,
            soins: soinsRes.rows,
            sales: salesRes.rows,
            formatDate,
            user: req.session.user
        });

    } catch (error) {
        console.error('Erreur lors du chargement du Dashboard:', error);
        res.status(500).send('Erreur serveur lors de la génération du tableau de bord.');
    }
};