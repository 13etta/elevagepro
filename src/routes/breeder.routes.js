const express = require('express');
const router = express.Router();
const breederController = require('../controllers/breeder.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Ancien tableau de bord structure : redirection vers la nouvelle interface premium.
router.get('/', (req, res) => res.redirect('/structure'));

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
// --- Registres Légaux ---
// Registre des Entrées et Sorties
router.get('/register/entries', breederController.getEntriesRegister);

// Modification d'une ligne du registre
router.get('/register/movements/:id/edit', breederController.getEditMovementForm);
router.post('/register/movements/:id/edit', breederController.updateMovement);

// --- Registre Sanitaire & Marche en Avant ---
router.get('/register/health', breederController.getHealthRegister);

// Ajout d'un événement au registre sanitaire
router.post('/register/health/record', breederController.addSanitaryRecord);

// Validation d'une tâche de nettoyage (Marche en avant)
router.post('/register/health/cleaning', breederController.addCleaningLog);

module.exports = router;
