const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const reproController = require('../controllers/reproduction.controller');

router.use(requireAuth);

router.get('/', reproController.getIndex);
router.post('/matings/new', reproController.addMating);
// Les routes addHeat et addPregnancy viendront se greffer ici plus tard

module.exports = router;