const express = require('express');
const router = express.Router();
const breederController = require('../controllers/breeder.controller');
const { requireAuth } = require('../middleware/auth');

// Toutes les routes de ce module nécessitent d'être connecté
router.use(requireAuth);

// Tableau de bord principal du module Élevage
router.get('/', breederController.getDashboard);

module.exports = router;