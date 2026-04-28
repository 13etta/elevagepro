const { pool } = require('../db');

exports.listLitters = async (req, res) => {
    // Garde ton listLitters actuel
};

exports.getCreateForm = async (req, res) => {
    // Garde ton getCreateForm actuel
};

exports.createLitter = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Début de la transaction
        const breederId = req.session.user.breeder_id;
        const { mother_id, birth_date, puppies_count_total, status, notes } = req.body;

        // 🧠 RECHERCHE INTELLIGENTE : Y a-t-il une gestation en cours pour cette chienne ?
        const activePregRes = await client.query(`
            SELECT id, mating_id FROM pregnancies 
            WHERE female_id = $1 AND breeder_id = $2 AND result = 'En cours'
        `, [mother_id, breederId]);

        let pregnancyId = null;
        let finalMatingId = req.body.mating_id || null;

        // 🧠 SYNCHRONISATION : Si trouvée, on la valide et on injecte la date de naissance
        if (activePregRes.rows.length > 0) {
            pregnancyId = activePregRes.rows[0].id;
            finalMatingId = activePregRes.rows[0].mating_id || finalMatingId; // On récupère la saillie d'origine

            await client.query(`
                UPDATE pregnancies 
                SET due_date = $1, result = 'Réussie', updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [birth_date, pregnancyId]);
        }

        // Création de la portée
        const result = await client.query(`
            INSERT INTO litters (breeder_id, mother_id, pregnancy_id, mating_id, birth_date, puppies_count_total, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [breederId, mother_id, pregnancyId, finalMatingId, birth_date, puppies_count_total || 0, status || 'active', notes]);

        await client.query('COMMIT');
        res.redirect(`/litters/${result.rows[0].id}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur création portée:', error);
        res.status(500).send('Erreur lors de la sauvegarde synchronisée.');
    } finally {
        client.release();
    }
};

exports.getEditForm = async (req, res) => {
    // Garde ton getEditForm actuel
};

exports.updateLitter = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const breederId = req.session.user.breeder_id;
        const litterId = req.params.id;
        const { mother_id, mating_id, birth_date, puppies_count_total, status, notes } = req.body;

        // 🧠 MISE À JOUR CASCADÉE : Si la portée est modifiée, on met à jour la date de la gestation
        const oldLitterRes = await client.query('SELECT pregnancy_id FROM litters WHERE id = $1 AND breeder_id = $2', [litterId, breederId]);
        
        if (oldLitterRes.rows.length > 0 && oldLitterRes.rows[0].pregnancy_id) {
            await client.query(`
                UPDATE pregnancies SET due_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
            `, [birth_date, oldLitterRes.rows[0].pregnancy_id]);
        }

        await client.query(`
            UPDATE litters 
            SET mother_id = $1, mating_id = $2, birth_date = $3, puppies_count_total = $4, status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND breeder_id = $8
        `, [mother_id, mating_id || null, birth_date, puppies_count_total || 0, status, notes, litterId, breederId]);

        await client.query('COMMIT');
        res.redirect('/litters');
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).send('Erreur lors de la synchronisation.');
    } finally {
        client.release();
    }
};

exports.showLitter = async (req, res) => {
    // Garde ton showLitter actuel
};
exports.deleteLitter = async (req, res) => {
    // Garde ton deleteLitter actuel
};