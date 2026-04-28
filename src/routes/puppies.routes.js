const express = require('express');
const router = express.Router();
const puppiesController = require('../controllers/puppies.controller');
const { ensureAuthenticated } = require('../middleware/auth'); // Vérifie si c'est requireAuth ou ensureAuthenticated dans ton projet

// Middleware d'authentification pour toutes les routes chiots
router.use(ensureAuthenticated);

// Liste des chiots (Si tu n'as pas encore listPuppies, on redirige vers le dashboard ou une autre vue)
router.get('/', (req, res) => res.redirect('/dashboard')); 

// Routes pour l'ajout (GET pour le formulaire, POST pour l'enregistrement)
router.get('/new', puppiesController.getForm);
router.post('/save', puppiesController.savePuppy);

// Routes pour l'édition
router.get('/edit/:id', puppiesController.getForm);
router.post('/save/:id', puppiesController.savePuppy);

// Route pour la suppression
router.get('/delete/:id', puppiesController.deletePuppy);

module.exports = router;