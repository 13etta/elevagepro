const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const registriesController = require('../controllers/registries.controller');

router.use(requireAuth);
router.use(verifyCsrf);

router.get('/', registriesController.getEntryExitRegistry);
router.post('/exit', registriesController.declareManualExit);

module.exports = router;
