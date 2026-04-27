const express = require('express');
const router = express.Router();
const matingsController = require('../controllers/matings.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Outil SCC : Simulation de portée (À placer AVANT /:id pour éviter les conflits de routes)
router.get('/virtual-litter', matingsController.getVirtualLitter);

// CRUD standard
router.get('/', matingsController.listMatings);
router.get('/new', matingsController.getCreateForm);
router.post('/new', matingsController.createMating);
router.get('/:id/edit', matingsController.getEditForm);
router.post('/:id/edit', matingsController.updateMating);
router.post('/:id/delete', matingsController.deleteMating);

module.exports = router;