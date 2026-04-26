const { pool } = require('../db');

exports.listLitters = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // Récupération des portées avec le nom de la mère et le décompte des chiots
        const litters = await pool.query(`
            SELECT l.id, l.birth_date, l.puppies_count_total, d.name AS mother_name,
                   (SELECT count(*) FROM puppies WHERE litter_id = l.id AND status = 'disponible') as available_puppies
            FROM litters l
            JOIN dogs d ON l.mother_id = d.id
            WHERE l.breeder_id = $1
            ORDER BY l.birth_date DESC
        `, [breederId]);

        // Récupération des mères potentielles pour le formulaire de naissance
        const females = await pool.query(`
            SELECT id, name FROM dogs 
            WHERE breeder_id = $1 AND sex = 'F' AND status = 'actif'
            ORDER BY name ASC
        `, [breederId]);

        res.render('litters/index', {
            litters: litters.rows,
            females: females.rows
        });
    } catch (error) {
        console.error('Erreur liste portées:', error);
        res.status(500).send('Erreur lors du chargement des portées.');
    }
};

exports.createLitter = async (req, res) => {
    const client = await pool.connect();
    try {
        const breederId = req.session.user.breeder_id;
        const { mother_id, birth_date, puppies_count_total, notes } = req.body;
        const count = parseInt(puppies_count_total, 10);

        await client.query('BEGIN');

        // 1. Création de la fiche "Portée"
        const litterRes = await client.query(`
            INSERT INTO litters (breeder_id, mother_id, birth_date, puppies_count_total, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [breederId, mother_id, birth_date, count, notes]);
        
        const newLitterId = litterRes.rows[0].id;

        // 2. Génération automatique des fiches "Chiots" vierges
        if (count > 0) {
            const puppyQuery = `
                INSERT INTO puppies (breeder_id, litter_id, name, status)
                VALUES ($1, $2, $3, 'disponible')
            `;
            for (let i = 1; i <= count; i++) {
                // On nomme temporairement les chiots Chiot 1, Chiot 2...
                await client.query(puppyQuery, [breederId, newLitterId, `Chiot ${i}`]);
            }
        }

        // Optionnel : Si une gestation correspondait à cette mère, on la passe en statut "terminée"
        await client.query(`
            UPDATE pregnancies SET status = 'terminee' 
            WHERE breeder_id = $1 AND dog_id = $2 AND status = 'en_cours'
        `, [breederId, mother_id]);

        await client.query('COMMIT');
        res.redirect('/litters');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur création portée:', error);
        res.status(500).send('Erreur lors de l\'enregistrement de la portée.');
    } finally {
        client.release();
    }
};