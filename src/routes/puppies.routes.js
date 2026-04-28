const express = require('express');
const router = express.Router();
const puppiesController = require('../controllers/puppies.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Route pour la vue d'ensemble de tous les chiots
router.get('/', puppiesController.listPuppies);

// Routes pour l'ajout, l'édition et la suppression
router.get('/new', puppiesController.getForm);
router.post('/new', puppiesController.savePuppy);
router.get('/:id/edit', puppiesController.getForm);
router.post('/:id/edit', puppiesController.savePuppy);
router.post('/:id/delete', puppiesController.deletePuppy);

module.exports = router;