const express = require('express');
const router = express.Router();
const geneticsController = require('../controllers/genetics.controller');
const { requireAuth } = require('../middleware/auth');

// Protection par authentification
router.use(requireAuth);

// Route pour afficher le simulateur
router.get('/simulator', geneticsController.getSimulator);

// Route pour traiter le calcul du COI (méthode POST)
router.post('/simulator', geneticsController.runSimulation);

module.exports = router;