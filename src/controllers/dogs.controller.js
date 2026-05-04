const { pool } = require('../db');

exports.listDogs = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const result = await pool.query('SELECT * FROM dogs WHERE breeder_id = $1 ORDER BY name ASC', [breederId]);
        res.render('dogs/index', { dogs: result.rows });
    } catch (error) {
        res.status(500).send('Erreur chargement.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        let dog = { status: 'actif' };

        if (dogId) {
            const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
            if (dogRes.rows.length > 0) dog = dogRes.rows[0];
        }

        let excludeCondition = dogId ? `AND id != $2` : '';
        let queryParams = dogId ? [breederId, dogId] : [breederId];

        const males = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'M' ${excludeCondition} ORDER BY name ASC`, queryParams);
        const females = await pool.query(`SELECT id, name FROM dogs WHERE breeder_id = $1 AND sex = 'F' ${excludeCondition} ORDER BY name ASC`, queryParams);

        res.render('dogs/form', { dog, males: males.rows, females: females.rows });
    } catch (error) {
        res.status(500).send('Erreur serveur.');
    }
};

exports.saveDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        
        let { 
            name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, lof, status, notes,
            father_id, mother_id, father_name_external, mother_name_external
        } = req.body;

        if (father_id) father_name_external = null;
        if (mother_id) mother_name_external = null;

        if (dogId) {
            await pool.query(`
                UPDATE dogs 
                SET name = $1, sex = $2, breed = $3, birth_date = $4, chip_number = $5, 
                    id_scc = $6, pedigree_number = $7, lof = $8, status = $9, notes = $10,
                    father_id = $11, mother_id = $12, father_name_external = $13, mother_name_external = $14,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $15 AND breeder_id = $16
            `, [name, sex, breed, birth_date || null, chip_number, id_scc, pedigree_number, lof, status, notes, 
                father_id || null, mother_id || null, father_name_external, mother_name_external, dogId, breederId]);
        } else {
            await pool.query(`
                INSERT INTO dogs (
                    breeder_id, name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, lof, status, notes,
                    father_id, mother_id, father_name_external, mother_name_external
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `, [breederId, name, sex, breed, birth_date || null, chip_number, id_scc, pedigree_number, lof, status, notes,
                father_id || null, mother_id || null, father_name_external, mother_name_external]);
        }
        res.redirect('/dogs');
    } catch (error) {
        res.status(500).send('Erreur sauvegarde.');
    }
};

exports.deleteDog = async (req, res) => {
    try {
        await pool.query('DELETE FROM dogs WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/dogs');
    } catch (error) {
        res.status(500).send('Erreur suppression.');
    }
};