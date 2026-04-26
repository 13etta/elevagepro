const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const registriesController = require('../controllers/registries.controller');

router.use(requireAuth);

router.get('/', registriesController.getEntryExitRegistry);
router.post('/exit', registriesController.declareManualExit);

module.exports = router;