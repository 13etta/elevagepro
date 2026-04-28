const { pool } = require('../db');

exports.listPuppies = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { q, sex, status, litter } = req.query;

        let query = `
            SELECT p.*, l.birth_date AS litter_date, f.name AS female_name 
            FROM puppies p
            LEFT JOIN litters l ON p.litter_id = l.id
            LEFT JOIN dogs f ON l.mother_id = f.id
            WHERE p.breeder_id = $1
        `;
        let params = [breederId];

        if (q) {
            params.push(`%${q}%`);
            query += ` AND (p.name ILIKE $${params.length} OR p.chip_number ILIKE $${params.length})`;
        }
        if (sex) {
            params.push(sex);
            query += ` AND p.sex = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND p.status = $${params.length}`;
        }
        if (litter) {
            params.push(litter);
            query += ` AND p.litter_id = $${params.length}`;
        }

        query += ' ORDER BY p.created_at DESC';
        const result = await pool.query(query, params);

        const litters = await pool.query(`
            SELECT l.id, d.name AS mother_name, l.birth_date 
            FROM litters l JOIN dogs d ON l.mother_id = d.id 
            WHERE l.breeder_id = $1 ORDER BY l.birth_date DESC
        `, [breederId]);

        res.render('puppies/index', { puppies: result.rows, litters: litters.rows, filters: req.query });
    } catch (error) {
        console.error('Erreur liste chiots:', error);
        res.status(500).send('Erreur lors du chargement des chiots.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const puppyId = req.params.id;
        const litterId = req.query.litter_id;

        let puppy = { status: 'Actif', litter_id: litterId };

        if (puppyId) {
            const puppyRes = await pool.query('SELECT * FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
            if (puppyRes.rows.length > 0) puppy = puppyRes.rows[0];
        }

        const litters = await pool.query(`
            SELECT l.id, d.name as mother_name, l.birth_date 
            FROM litters l 
            JOIN dogs d ON l.mother_id = d.id 
            WHERE l.breeder_id = $1 
            ORDER BY l.birth_date DESC
        `, [breederId]);

        res.render('puppies/form', { puppy, litters: litters.rows });
    } catch (error) {
        console.error('Erreur formulaire chiot:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.savePuppy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const puppyId = req.params.id;
        const { litter_id, name, sex, color, chip_number, birth_date, status, sale_price, notes } = req.body;

        if (puppyId) {
            await pool.query(`
                UPDATE puppies 
                SET litter_id = $1, name = $2, sex = $3, color = $4, chip_number = $5, birth_date = $6, status = $7, sale_price = $8, notes = $9
                WHERE id = $10 AND breeder_id = $11
            `, [litter_id, name, sex, color, chip_number, birth_date || null, status, sale_price || null, notes, puppyId, breederId]);
        } else {
            await pool.query(`
                INSERT INTO puppies (breeder_id, litter_id, name, sex, color, chip_number, birth_date, status, sale_price, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [breederId, litter_id, name, sex, color, chip_number, birth_date || null, status, sale_price || null, notes]);
        }

        res.redirect(`/litters/${litter_id}`);
    } catch (error) {
        console.error('Erreur sauvegarde chiot:', error);
        res.status(500).send('Erreur lors de la sauvegarde.');
    }
};

exports.deletePuppy = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const puppyId = req.params.id;
        
        const puppyRes = await pool.query('SELECT litter_id FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
        
        if (puppyRes.rows.length > 0) {
            const litterId = puppyRes.rows[0].litter_id;
            await pool.query('DELETE FROM puppies WHERE id = $1 AND breeder_id = $2', [puppyId, breederId]);
            res.redirect(`/litters/${litterId}`);
        } else {
            res.redirect('/puppies');
        }
    } catch (error) {
        console.error('Erreur suppression chiot:', error);
        res.status(500).send('Erreur suppression.');
    }
};