const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard.controller.js');

// La route est protégée par le middleware et déléguée au contrôleur
router.get('/', requireAuth, dashboardController.getDashboard);

module.exports = router;