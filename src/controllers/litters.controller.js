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
// Afficher le détail d'une portée et la liste de ses chiots
exports.getLitterDetails = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;

        // 1. Récupération des infos de la portée
        const litterRes = await pool.query(`
            SELECT l.*, d.name AS mother_name
            FROM litters l JOIN dogs d ON l.mother_id = d.id
            WHERE l.id = $1 AND l.breeder_id = $2
        `, [litterId, breederId]);

        if (litterRes.rows.length === 0) {
            return res.status(404).send('Portée introuvable ou accès refusé.');
        }

        // 2. Récupération des chiots de cette portée
        const puppiesRes = await pool.query(`
            SELECT * FROM puppies WHERE litter_id = $1 ORDER BY name ASC
        `, [litterId]);

        res.render('litters/show', {
            litter: litterRes.rows[0],
            puppies: puppiesRes.rows
        });
    } catch (error) {
        console.error('Erreur détail portée:', error);
        res.status(500).send('Erreur lors du chargement des détails.');
    }
};

// Mettre à jour les informations d'un chiot spécifique
exports.updatePuppy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const puppyId = req.params.puppyId;
        const { name, sex, color, chip_number, sale_price, status } = req.body;

        await pool.query(`
            UPDATE puppies 
            SET name = $1, sex = $2, color = $3, chip_number = $4, sale_price = $5, status = $6
            WHERE id = $7 AND breeder_id = $8
        `, [name, sex || null, color, chip_number, sale_price || null, status, puppyId, breederId]);

        // On redirige vers la page de la portée (on récupère le litter_id via le referer ou le body, ici on simplifie avec un redirect back)
        res.redirect('back');
    } catch (error) {
        console.error('Erreur mise à jour chiot:', error);
        res.status(500).send('Erreur lors de la sauvegarde du chiot.');
    }
};