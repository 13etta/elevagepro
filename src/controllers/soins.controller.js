const { pool } = require('../db');

exports.listSoins = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        
        // On récupère les soins avec le nom du chien associé
        const result = await pool.query(`
            SELECT s.id, s.type, s.label, s.event_date, s.next_due, d.name AS dog_name
            FROM soins s
            LEFT JOIN dogs d ON s.dog_id = d.id
            WHERE s.breeder_id = $1
            ORDER BY s.event_date DESC
        `, [breederId]);

        // On a besoin de la liste des chiens actifs pour le formulaire d'ajout rapide
        const dogsResult = await pool.query(`
            SELECT id, name FROM dogs WHERE breeder_id = $1 AND status = 'actif' ORDER BY name ASC
        `, [breederId]);

        res.render('soins/index', { 
            soins: result.rows,
            dogs: dogsResult.rows,
            user: req.session.user
        });
    } catch (error) {
        console.error('Erreur liste soins:', error);
        res.status(500).send('Erreur lors de la récupération du registre de santé.');
    }
};

exports.createSoin = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { dog_id, type, label, event_date, next_due, notes } = req.body;

        await client.query('BEGIN'); // Début de la transaction sécurisée

        // 1. Enregistrement du soin dans le registre
        await client.query(`
            INSERT INTO soins (breeder_id, dog_id, type, label, event_date, next_due, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [breederId, dog_id || null, type, label, event_date, next_due || null, notes]);

        // 2. Création automatique du rappel si une date d'échéance est prévue
        if (next_due) {
            const reminderTitle = `Rappel : ${label} (${type})`;
            await client.query(`
                INSERT INTO reminders (breeder_id, dog_id, type, title, due_date)
                VALUES ($1, $2, $3, $4, $5)
            `, [breederId, dog_id || null, type, reminderTitle, next_due]);
        }

        await client.query('COMMIT'); // Validation
        res.redirect('/soins');
    } catch (error) {
        await client.query('ROLLBACK'); // Annulation globale en cas de faille
        console.error('Erreur création soin:', error);
        res.status(500).send('Erreur lors de l\'enregistrement du soin.');
    } finally {
        client.release();
    }
};