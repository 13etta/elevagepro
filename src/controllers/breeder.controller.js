const { pool } = require('../db');

async function tableExists(tableName) {
    const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]);
    return Boolean(result.rows[0]?.exists);
}

exports.getDashboard = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        const infraRes = await pool.query(
            'SELECT * FROM infrastructures WHERE breeder_id = $1 ORDER BY type ASC, name ASC',
            [breederId]
        );

        const staffRes = await pool.query(
            'SELECT * FROM staff WHERE breeder_id = $1 ORDER BY status ASC, last_name ASC',
            [breederId]
        );

        res.render('breeder/index', {
            title: 'Gestion de l\'élevage',
            infrastructures: infraRes.rows,
            staff: staffRes.rows
        });

    } catch (error) {
        console.error('Erreur lors du chargement du module Breeder:', error);
        res.status(500).send('Erreur serveur lors du chargement du module de gestion de l\'élevage.');
    }
};

exports.getInfraForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const infraId = req.params.id;
        let infra = { status: 'actif', capacity: 1 };

        if (infraId) {
            const result = await pool.query(
                'SELECT * FROM infrastructures WHERE id = $1 AND breeder_id = $2',
                [infraId, breederId]
            );

            if (result.rows.length > 0) {
                infra = result.rows[0];
            } else {
                return res.redirect('/breeder');
            }
        }

        res.render('breeder/infra-form', { infra });
    } catch (error) {
        console.error('Erreur getInfraForm:', error);
        res.status(500).send('Erreur lors du chargement du formulaire.');
    }
};

exports.saveInfra = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const infraId = req.params.id;
        const { name, type, capacity, status } = req.body;

        if (infraId) {
            await pool.query(
                'UPDATE infrastructures SET name = $1, type = $2, capacity = $3, status = $4 WHERE id = $5 AND breeder_id = $6',
                [name, type, capacity || 1, status, infraId, breederId]
            );
        } else {
            await pool.query(
                'INSERT INTO infrastructures (breeder_id, name, type, capacity, status) VALUES ($1, $2, $3, $4, $5)',
                [breederId, name, type, capacity || 1, status || 'actif']
            );
        }

        res.redirect('/breeder');
    } catch (error) {
        console.error('Erreur saveInfra:', error);
        res.status(500).send('Erreur lors de la sauvegarde de l\'infrastructure.');
    }
};

exports.deleteInfra = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const infraId = req.params.id;

        await pool.query(
            'DELETE FROM infrastructures WHERE id = $1 AND breeder_id = $2',
            [infraId, breederId]
        );

        res.redirect('/breeder');
    } catch (error) {
        console.error('Erreur deleteInfra:', error);
        res.status(500).send('Erreur lors de la suppression.');
    }
};

exports.getEntriesRegister = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const hasMovements = await tableExists('movements');
        const hasLegacy = await tableExists('animal_movements');
        let query;

        if (hasMovements && hasLegacy) {
            query = `
                SELECT
                    ('movements:' || m.id::text) AS row_id,
                    m.id::text AS id,
                    'movements' AS source_table,
                    m.movement_date,
                    upper(m.movement_type) AS movement_type,
                    m.reason AS movement_reason,
                    m.animal_name,
                    m.animal_type AS breed,
                    m.chip_number AS identification,
                    m.provenance_destination AS third_party_info,
                    m.notes,
                    m.created_at
                FROM movements m
                WHERE m.breeder_id = $1

                UNION ALL

                SELECT
                    ('animal_movements:' || am.id::text) AS row_id,
                    am.id::text AS id,
                    'animal_movements' AS source_table,
                    am.movement_date,
                    upper(am.movement_type) AS movement_type,
                    am.movement_reason,
                    am.animal_name,
                    am.breed,
                    am.identification,
                    am.third_party_info,
                    am.notes,
                    am.created_at
                FROM animal_movements am
                WHERE am.breeder_id = $1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM movements m2
                      WHERE m2.breeder_id = am.breeder_id
                        AND lower(trim(m2.animal_name)) = lower(trim(am.animal_name))
                        AND COALESCE(trim(m2.chip_number), '') = COALESCE(trim(am.identification), '')
                        AND m2.movement_date = am.movement_date
                        AND upper(m2.movement_type) = upper(am.movement_type)
                  )
                ORDER BY movement_date DESC, created_at DESC
            `;
        } else if (hasMovements) {
            query = `
                SELECT
                    ('movements:' || m.id::text) AS row_id,
                    m.id::text AS id,
                    'movements' AS source_table,
                    m.movement_date,
                    upper(m.movement_type) AS movement_type,
                    m.reason AS movement_reason,
                    m.animal_name,
                    m.animal_type AS breed,
                    m.chip_number AS identification,
                    m.provenance_destination AS third_party_info,
                    m.notes,
                    m.created_at
                FROM movements m
                WHERE m.breeder_id = $1
                ORDER BY m.movement_date DESC, m.created_at DESC
            `;
        } else if (hasLegacy) {
            query = `
                SELECT
                    ('animal_movements:' || am.id::text) AS row_id,
                    am.id::text AS id,
                    'animal_movements' AS source_table,
                    am.movement_date,
                    upper(am.movement_type) AS movement_type,
                    am.movement_reason,
                    am.animal_name,
                    am.breed,
                    am.identification,
                    am.third_party_info,
                    am.notes,
                    am.created_at
                FROM animal_movements am
                WHERE am.breeder_id = $1
                ORDER BY am.movement_date DESC, am.created_at DESC
            `;
        }

        const movementsRes = query ? await pool.query(query, [breederId]) : { rows: [] };

        res.render('breeder/register-entries', {
            title: 'Registre des Entrées et Sorties',
            movements: movementsRes.rows
        });

    } catch (error) {
        console.error('Erreur getEntriesRegister:', error);
        res.status(500).send('Erreur lors du chargement du registre.');
    }
};

exports.getEditMovementForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const rawMovementId = String(req.params.id || '');
        const [sourceTable, movementId] = rawMovementId.includes(':')
            ? rawMovementId.split(':')
            : ['animal_movements', rawMovementId];

        let result;
        if (sourceTable === 'movements') {
            result = await pool.query(
                `SELECT
                    id::text AS id,
                    'movements' AS source_table,
                    movement_date,
                    reason AS movement_reason,
                    provenance_destination AS third_party_info,
                    notes
                 FROM movements
                 WHERE id = $1 AND breeder_id = $2`,
                [movementId, breederId]
            );
        } else {
            result = await pool.query(
                `SELECT
                    id::text AS id,
                    'animal_movements' AS source_table,
                    movement_date,
                    movement_reason,
                    third_party_info,
                    notes
                 FROM animal_movements
                 WHERE id = $1 AND breeder_id = $2`,
                [movementId, breederId]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).send('Ligne du registre introuvable.');
        }

        res.render('breeder/register-edit', {
            title: 'Modifier le registre',
            movement: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur getEditMovementForm:', error);
        res.status(500).send('Erreur lors de l\'ouverture du formulaire.');
    }
};

exports.updateMovement = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const rawMovementId = String(req.params.id || '');
        const [sourceTable, movementId] = rawMovementId.includes(':')
            ? rawMovementId.split(':')
            : ['animal_movements', rawMovementId];
        const { movement_date, movement_reason, third_party_info, notes } = req.body;

        if (sourceTable === 'movements') {
            await pool.query(
                `UPDATE movements
                 SET movement_date = $1,
                     reason = $2,
                     provenance_destination = $3,
                     notes = $4
                 WHERE id = $5 AND breeder_id = $6`,
                [movement_date, movement_reason, third_party_info, notes, movementId, breederId]
            );
        } else {
            await pool.query(
                `UPDATE animal_movements
                 SET movement_date = $1,
                     movement_reason = $2,
                     third_party_info = $3,
                     notes = $4
                 WHERE id = $5 AND breeder_id = $6`,
                [movement_date, movement_reason, third_party_info, notes, movementId, breederId]
            );
        }

        res.redirect('/breeder/register/entries');
    } catch (error) {
        console.error('Erreur updateMovement:', error);
        res.status(500).send('Erreur lors de la mise à jour du registre.');
    }
};

exports.getHealthRegister = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        const recordsRes = await pool.query(
            'SELECT * FROM sanitary_records WHERE breeder_id = $1 ORDER BY event_date DESC',
            [breederId]
        );

        const cleaningRes = await pool.query(
            'SELECT * FROM cleaning_logs WHERE breeder_id = $1 ORDER BY cleaning_date DESC, created_at DESC LIMIT 50',
            [breederId]
        );

        const infraRes = await pool.query(
            'SELECT * FROM infrastructures WHERE breeder_id = $1 ORDER BY type ASC, name ASC',
            [breederId]
        );

        res.render('breeder/register-health', {
            title: 'Registre Sanitaire & Hygiène',
            records: recordsRes.rows,
            cleaningLogs: cleaningRes.rows,
            infrastructures: infraRes.rows
        });
    } catch (error) {
        console.error('Erreur getHealthRegister:', error);
        res.status(500).send('Erreur lors du chargement du registre sanitaire.');
    }
};

exports.addSanitaryRecord = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { event_date, event_type, description, animals_concerned, vet_name } = req.body;

        await pool.query(
            `INSERT INTO sanitary_records (breeder_id, event_date, event_type, description, animals_concerned, vet_name)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [breederId, event_date, event_type, description, animals_concerned, vet_name]
        );

        res.redirect('/breeder/register/health');
    } catch (error) {
        console.error('Erreur addSanitaryRecord:', error);
        res.status(500).send('Erreur lors de l\'ajout de l\'événement sanitaire.');
    }
};

exports.addCleaningLog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const { cleaning_date, zone_type, protocol_used, done_by, notes } = req.body;

        await pool.query(
            `INSERT INTO cleaning_logs (breeder_id, cleaning_date, zone_type, protocol_used, done_by, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [breederId, cleaning_date, zone_type, protocol_used, done_by, notes]
        );

        res.redirect('/breeder/register/health');
    } catch (error) {
        console.error('Erreur addCleaningLog:', error);
        res.status(500).send('Erreur lors de l\'ajout du rapport de nettoyage.');
    }
};