const express = require('express');
const router = express.Router();
const cynognosticController = require('../controllers/cynognostic.controller');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

router.use(requireAuth);

router.get('/', cynognosticController.index);
router.post('/analyze', verifyCsrf, cynognosticController.runAnalysis);
router.get('/reports/:id', cynognosticController.showReport);
router.post('/watch-profiles', verifyCsrf, cynognosticController.createWatch);

module.exports = router;
