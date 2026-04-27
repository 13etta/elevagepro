const express = require('express');
const router = express.Router();
const heatsController = require('../controllers/heats.controller');
const { requireAuth } = require('../middleware/auth');

// Protection globale du module
router.use(requireAuth);

// Lecture
router.get('/', heatsController.listHeats);

// Création
router.get('/new', heatsController.getCreateForm);
router.post('/new', heatsController.createHeat);

// Édition
router.get('/:id/edit', heatsController.getEditForm);
router.post('/:id/edit', heatsController.updateHeat);

// Suppression
router.post('/:id/delete', heatsController.deleteHeat);

module.exports = router;