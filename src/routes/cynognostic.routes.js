const express = require('express');
const router = express.Router();
const cynognosticController = require('../controllers/cynognostic.controller');
const statgesconController = require('../controllers/statgescon.controller');
const transmissionController = require('../controllers/transmission.controller');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

router.use(requireAuth);

router.get('/', cynognosticController.index);
router.post('/analyze', verifyCsrf, cynognosticController.runAnalysis);
router.get('/reports/:id', cynognosticController.showReport);
router.post('/watch-profiles', verifyCsrf, cynognosticController.createWatch);
router.get('/statgescon', statgesconController.form);
router.post('/statgescon/search', verifyCsrf, statgesconController.search);
router.get('/transmission', transmissionController.form);
router.post('/transmission/search-dog', verifyCsrf, transmissionController.searchDog);
router.post('/transmission/fetch-sheet', verifyCsrf, transmissionController.fetchSheet);
router.post('/transmission/analyze', verifyCsrf, transmissionController.analyze);

module.exports = router;
