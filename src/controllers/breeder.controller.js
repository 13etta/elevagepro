const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;

        // 1. Récupération des infrastructures
        const infraRes = await pool.query(
            'SELECT * FROM infrastructures WHERE breeder_id = $1 ORDER BY type ASC, name ASC',
            [breederId]
        );

        // 2. Récupération de l'équipe
        const staffRes = await pool.query(
            'SELECT * FROM staff WHERE breeder_id = $1 ORDER BY status ASC, last_name ASC',
            [breederId]
        );

        // 3. (Futur) Récupération des derniers mouvements pour le registre
        // const movementsRes = await pool.query('...');

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
// --- FONCTIONS INFRASTRUCTURES ---

// Afficher le formulaire d'ajout/modification
exports.getInfraForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const infraId = req.params.id;
        
        // Valeurs par défaut pour une nouvelle infrastructure
        let infra = { status: 'actif', capacity: 1 }; 

        if (infraId) {
            // Mode modification : on récupère les données existantes
            const result = await pool.query(
                'SELECT * FROM infrastructures WHERE id = $1 AND breeder_id = $2',
                [infraId, breederId]
            );
            
            if (result.rows.length > 0) {
                infra = result.rows[0];
            } else {
                // Sécurité : l'infrastructure n'existe pas ou n'appartient pas à cet éleveur
                return res.redirect('/breeder');
            }
        }

        res.render('breeder/infra-form', { infra });
    } catch (error) {
        console.error('Erreur getInfraForm:', error);
        res.status(500).send('Erreur lors du chargement du formulaire.');
    }
};

// Sauvegarder (Création ou Mise à jour)
exports.saveInfra = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const infraId = req.params.id;
        const { name, type, capacity, status } = req.body;

        if (infraId) {
            // Mise à jour (UPDATE)
            await pool.query(
                'UPDATE infrastructures SET name = $1, type = $2, capacity = $3, status = $4 WHERE id = $5 AND breeder_id = $6',
                [name, type, capacity || 1, status, infraId, breederId]
            );
        } else {
            // Création (INSERT)
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

// Supprimer une infrastructure
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

        // Récupération de tous les mouvements, du plus récent au plus ancien
        const movementsRes = await pool.query(
            `SELECT * FROM animal_movements 
             WHERE breeder_id = $1 
             ORDER BY movement_date DESC, created_at DESC`,
            [breederId]
        );

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
        const movementId = req.params.id;

        const result = await pool.query(
            'SELECT * FROM animal_movements WHERE id = $1 AND breeder_id = $2',
            [movementId, breederId]
        );

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
        const movementId = req.params.id;
        
        // Seuls ces champs sont modifiables pour garantir l'intégrité
        const { movement_date, movement_reason, third_party_info, notes } = req.body;

        await pool.query(
            `UPDATE animal_movements 
             SET movement_date = $1, 
                 movement_reason = $2, 
                 third_party_info = $3, 
                 notes = $4 
             WHERE id = $5 AND breeder_id = $6`,
            [movement_date, movement_reason, third_party_info, notes, movementId, breederId]
        );

        res.redirect('/breeder/register/entries');
    } catch (error) {
        console.error('Erreur updateMovement:', error);
        res.status(500).send('Erreur lors de la mise à jour du registre.');
    }
};