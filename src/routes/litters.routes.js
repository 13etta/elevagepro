const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const littersController = require('../controllers/litters.controller');

router.use(requireAuth);

router.get('/', littersController.listLitters);
router.post('/new', littersController.createLitter);
// Voir le détail d'une portée
router.get('/:id', littersController.getLitterDetails);

// Mettre à jour un chiot (cette route appartient techniquement aux chiots, mais on la groupe ici pour simplifier)
router.post('/puppies/:puppyId/edit', littersController.updatePuppy);

module.exports = router;
