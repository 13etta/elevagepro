const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const soinsController = require('../controllers/soins.controller');
const soinsPdfController = require('../controllers/soins-pdf.controller');

router.use(requireAuth);

router.get('/', soinsController.listSoins);
router.get('/registre-sanitaire.pdf', soinsPdfController.exportHealthRegister);
router.post('/new', soinsController.createSoin);
router.get('/:id/edit', soinsController.editSoin);
router.post('/:id/edit', soinsController.updateSoin);
router.post('/:id/delete', soinsController.deleteSoin);

module.exports = router;
