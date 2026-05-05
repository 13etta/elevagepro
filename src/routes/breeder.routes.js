const express = require('express');
const router = express.Router();
const breederController = require('../controllers/breeder.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Tableau de bord principal
router.get('/', breederController.getDashboard);

// --- Gestion des Infrastructures ---
// Afficher le formulaire (Création)
router.get('/infrastructure/new', breederController.getInfraForm);
// Enregistrer (Création)
router.post('/infrastructure/new', breederController.saveInfra);

// Afficher le formulaire (Modification)
router.get('/infrastructure/:id/edit', breederController.getInfraForm);
// Enregistrer (Modification)
router.post('/infrastructure/:id/edit', breederController.saveInfra);

// Suppression
router.post('/infrastructure/:id/delete', breederController.deleteInfra);

module.exports = router;