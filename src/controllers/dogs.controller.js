const { pool } = require('../db');

exports.listDogs = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        // On récupère tous les chiens de l'élevage, triés par statut (les actifs d'abord) puis par nom
        const result = await pool.query(`
            SELECT id, name, breed, sex, status, chip_number 
            FROM dogs 
            WHERE breeder_id = $1 
            ORDER BY 
                CASE WHEN status = 'actif' THEN 1 ELSE 2 END, 
                name ASC
        `, [breederId]);

        res.render('dogs/list', { 
            dogs: result.rows,
            user: req.session.user
        });
    } catch (error) {
        console.error('Erreur liste chiens:', error);
        res.status(500).send('Erreur lors de la récupération des chiens.');
    }
};

exports.getCreateForm = async (req, res) => {
    // Pour le formulaire d'ajout, on a besoin de lister les autres chiens pour les champs Père/Mère
    try {
        const breederId = req.session.user.breeder_id;
        const result = await pool.query(`
            SELECT id, name, sex FROM dogs WHERE breeder_id = $1 ORDER BY name ASC
        `, [breederId]);
        
        res.render('dogs/create', { 
            dogs: result.rows,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).send('Erreur lors du chargement du formulaire.');
    }
};

exports.createDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        // On extrait toutes les données du formulaire POST
        const { name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, father_id, mother_id, notes } = req.body;

        // Insertion sécurisée
        await pool.query(`
            INSERT INTO dogs (breeder_id, name, sex, breed, birth_date, chip_number, id_scc, pedigree_number, father_id, mother_id, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'actif')
        `, [
            breederId, name, sex, breed, 
            birth_date || null, chip_number, id_scc, pedigree_number, 
            father_id || null, mother_id || null, notes
        ]);

        // Redirection vers la liste après succès
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur création chien:', error);
        res.status(500).send('Erreur lors de la création du chien.');
    }
};
// Afficher la fiche détaillée d'un chien
exports.getDogDetails = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        // 1. Récupération des informations du chien et du nom de ses parents
        const dogRes = await pool.query(`
            SELECT d.*, 
                   f.name AS father_name, 
                   m.name AS mother_name
            FROM dogs d
            LEFT JOIN dogs f ON d.father_id = f.id
            LEFT JOIN dogs m ON d.mother_id = m.id
            WHERE d.id = $1 AND d.breeder_id = $2
        `, [dogId, breederId]);

        if (dogRes.rows.length === 0) {
            return res.status(404).send('Chien introuvable ou accès refusé.');
        }

        // 2. Récupération de son historique de santé (5 derniers soins)
        const soinsRes = await pool.query(`
            SELECT * FROM soins 
            WHERE dog_id = $1 AND breeder_id = $2 
            ORDER BY event_date DESC LIMIT 5
        `, [dogId, breederId]);

        res.render('dogs/show', {
            dog: dogRes.rows[0],
            soins: soinsRes.rows
        });
    } catch (error) {
        console.error('Erreur détail chien:', error);
        res.status(500).send('Erreur lors du chargement de la fiche du chien.');
    }
};
exports.updateDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        
        // Extraction de toutes les données du formulaire, y compris le statut
        const { name, sex, breed, chip_number, birth_date, status, notes } = req.body;

        await pool.query(`
            UPDATE dogs 
            SET name = $1, 
                sex = $2, 
                breed = $3, 
                chip_number = $4, 
                birth_date = $5, 
                status = $6, 
                notes = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND breeder_id = $9
        `, [name, sex, breed, chip_number, birth_date, status, notes, dogId, breederId]);

        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du chien:', error);
        res.status(500).send('Erreur lors de la sauvegarde du profil.');
    }
};
exports.getEditForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;

        // Récupération stricte : on vérifie l'ID du chien ET l'ID de l'éleveur
        const dogResult = await pool.query(`
            SELECT * FROM dogs 
            WHERE id = $1 AND breeder_id = $2
        `, [dogId, breederId]);

        if (dogResult.rows.length === 0) {
            return res.status(404).send('Chien introuvable ou accès non autorisé.');
        }

        // On renvoie la vue d'édition avec les données du chien
        res.render('dogs/edit', { dog: dogResult.rows[0] });
        
    } catch (error) {
        console.error('Erreur lors du chargement du formulaire d\'édition :', error);
        res.status(500).send('Erreur interne du serveur.');
    }
};