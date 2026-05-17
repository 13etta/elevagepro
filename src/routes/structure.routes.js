const express = require('express');
const { requireAuth } = require('../middleware/auth');
const structureController = require('../controllers/structure.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/', structureController.index);
router.post('/infrastructures', structureController.storeInfrastructure);
router.post('/assign', structureController.assignInfrastructure);

module.exports = router;
