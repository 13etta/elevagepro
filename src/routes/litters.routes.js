const express = require('express');
const router = express.Router();
const littersController = require('../controllers/litters.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Liste et filtres
router.get('/', littersController.listLitters);

// Création
router.get('/new', littersController.getCreateForm);
router.post('/new', littersController.createLitter);

// Vue de détail (celle de ta capture d'écran pour gérer les chiots)
router.get('/:id', littersController.showLitter);

// Édition
router.get('/:id/edit', littersController.getEditForm);
router.post('/:id/edit', littersController.updateLitter);

// Suppression
router.post('/:id/delete', littersController.deleteLitter);

module.exports = router;