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