const express = require('express');
const router = express.Router();
const littersController = require('../controllers/litters.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Liste
router.get('/', littersController.listLitters);

// Création
router.get('/new', littersController.getCreateForm);
router.post('/new', littersController.createLitter);

// Vue de détail
router.get('/:id', littersController.showLitter);

// ÉDITION (C'est ici que l'aiguillage se joue)
router.get('/:id/edit', littersController.getEditForm);
router.post('/:id/edit', littersController.updateLitter);

// Suppression
router.post('/:id/delete', littersController.deleteLitter);

module.exports = router;