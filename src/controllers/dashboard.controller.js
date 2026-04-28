const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS puppy_id UUID REFERENCES puppies(id) ON DELETE CASCADE').catch(() => {});
        await pool.query('ALTER TABLE reminders ADD COLUMN IF NOT EXISTS litter_id UUID REFERENCES litters(id) ON DELETE CASCADE').catch(() => {});
        await pool.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS documents_checked JSONB DEFAULT '{}'::jsonb`).catch(() => {});

        const activeDogs = await pool.query(`SELECT count(*) FROM dogs WHERE breeder_id = $1 AND status = 'Actif'`, [breederId]);
        const availablePuppies = await pool.query(`SELECT count(*) FROM puppies WHERE breeder_id = $1 AND status ILIKE 'disponible'`, [breederId]);
        const activeLitters = await pool.query(`SELECT count(*) FROM litters WHERE breeder_id = $1 AND status IN ('active', 'sevrage')`, [breederId]);
        const ongoingPregnancies = await pool.query(`SELECT count(*) FROM pregnancies WHERE breeder_id = $1 AND result = 'En cours'`, [breederId]);
        const incompleteSales = await pool.query(`SELECT count(*) FROM sales WHERE breeder_id = $1 AND is_reservation = TRUE`, [breederId]);
        const puppiesWithoutChip = await pool.query(`SELECT count(*) FROM puppies WHERE breeder_id = $1 AND COALESCE(chip_number, '') = '' AND COALESCE(lower(status), '') NOT IN ('vendu', 'vendue')`, [breederId]);

        const kpis = {
            activeDogs: activeDogs.rows[0].count,
            availablePuppies: availablePuppies.rows[0].count,
            activeLitters: activeLitters.rows[0].count,
            ongoingPregnancies: ongoingPregnancies.rows[0].count,
            incompleteSales: incompleteSales.rows[0].count,
            puppiesWithoutChip: puppiesWithoutChip.rows[0].count,
        };

        const remindersRes = await pool.query(`
            SELECT
              r.due_date,
              r.title AS label,
              COALESCE(d.name, p.name, lm.name) AS dog_name,
              CASE
                WHEN r.puppy_id IS NOT NULL THEN 'Chiot'
                WHEN r.litter_id IS NOT NULL THEN 'Portée'
                WHEN r.dog_id IS NOT NULL THEN 'Chien'
                ELSE 'Général'
              END AS scope
            FROM reminders r
            LEFT JOIN dogs d ON r.dog_id = d.id
            LEFT JOIN puppies p ON r.puppy_id = p.id
            LEFT JOIN litters l ON r.litter_id = l.id
            LEFT JOIN dogs lm ON l.mother_id = lm.id
            WHERE r.breeder_id = $1 AND r.is_completed = FALSE
            ORDER BY r.due_date ASC
            LIMIT 8
        `, [breederId]);

        const soinsRes = await pool.query(`
            SELECT s.event_date, s.type, s.label, COALESCE(d.name, p.name) AS dog_name
            FROM soins s
            LEFT JOIN dogs d ON s.dog_id = d.id
            LEFT JOIN puppies p ON s.puppy_id = p.id
            WHERE s.breeder_id = $1
            ORDER BY s.event_date DESC
            LIMIT 5
        `, [breederId]).catch(() => ({ rows: [] }));

        const salesRes = await pool.query(`
            SELECT sale_date, buyer_name AS buyer_firstname, price AS total_price, is_reservation, deposit_amount
            FROM sales
            WHERE breeder_id = $1
            ORDER BY sale_date DESC
            LIMIT 5
        `, [breederId]);

        const lateReminders = remindersRes.rows.filter((r) => r.due_date && new Date(r.due_date) < new Date());

        const salesToFinalize = await pool.query(`
          SELECT s.id, s.buyer_name, s.price, s.deposit_amount, COALESCE(p.name, d.name) AS animal_name
          FROM sales s
          LEFT JOIN puppies p ON s.puppy_id = p.id
          LEFT JOIN dogs d ON s.dog_id = d.id
          WHERE s.breeder_id = $1 AND s.is_reservation = TRUE
          ORDER BY s.sale_date ASC
          LIMIT 5
        `, [breederId]);

        const littersWithoutPuppies = await pool.query(`
          SELECT l.id, l.birth_date, d.name AS mother_name
          FROM litters l
          LEFT JOIN dogs d ON l.mother_id = d.id
          LEFT JOIN puppies p ON p.litter_id = l.id
          WHERE l.breeder_id = $1 AND l.status IN ('active', 'sevrage')
          GROUP BY l.id, d.name
          HAVING count(p.id) = 0
          ORDER BY l.birth_date DESC
          LIMIT 5
        `, [breederId]);

        const alerts = [];
        if (lateReminders.length) alerts.push({ level: 'danger', title: `${lateReminders.length} rappel(s) en retard`, href: '/reminders' });
        if (salesToFinalize.rows.length) alerts.push({ level: 'warning', title: `${salesToFinalize.rows.length} réservation(s) à finaliser`, href: '/sales' });
        if (littersWithoutPuppies.rows.length) alerts.push({ level: 'warning', title: `${littersWithoutPuppies.rows.length} portée(s) sans chiots enregistrés`, href: '/litters' });
        if (Number(kpis.puppiesWithoutChip) > 0) alerts.push({ level: 'info', title: `${kpis.puppiesWithoutChip} chiot(s) sans identification`, href: '/puppies' });

        const formatDate = (dateString) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('fr-FR');
        };

        res.render('dashboard', {
            kpis,
            alerts,
            reminders: remindersRes.rows,
            soins: soinsRes.rows,
            sales: salesRes.rows,
            salesToFinalize: salesToFinalize.rows,
            littersWithoutPuppies: littersWithoutPuppies.rows,
            formatDate,
            user: req.session.user
        });

    } catch (error) {
        console.error('Erreur lors du chargement du Dashboard:', error);
        res.status(500).send('Erreur serveur lors de la génération du tableau de bord.');
    }
};