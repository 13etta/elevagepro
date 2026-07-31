const express = require('express');
const router = express.Router();
const pregnanciesController = require('../controllers/pregnancies.controller');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

router.use(requireAuth);
router.use(verifyCsrf);

router.get('/', pregnanciesController.listPregnancies);
router.get('/new', pregnanciesController.getForm);
router.post('/new', pregnanciesController.savePregnancy);
router.get('/:id/edit', pregnanciesController.getForm);
router.post('/:id/edit', pregnanciesController.savePregnancy);
router.post('/:id/delete', pregnanciesController.deletePregnancy);

module.exports = router;
