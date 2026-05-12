const express = require('express');
const router = express.Router();
const littersController = require('../controllers/litters.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Liste
router.get('/', littersController.listLitters);

// Création (Utilise la fonction unifiée)
router.get('/new', littersController.getForm);
router.post('/new', littersController.saveLitter);

// Vue de détail
router.get('/:id', littersController.showLitter);

// Modification (Utilise la même fonction unifiée)
router.get('/:id/edit', littersController.getForm);
router.post('/:id/edit', littersController.saveLitter);

// Suppression
router.post('/:id/delete', littersController.deleteLitter);

module.exports = router;