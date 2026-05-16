const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const reproController = require('../controllers/reproduction.controller');

router.use(requireAuth);

router.get('/', reproController.getIndex);
router.post('/matings/new', reproController.addMating);
router.post('/matings/:id/confirm', reproController.confirmMating);
router.post('/matings/:id/failed', reproController.markMatingFailed);

module.exports = router;