const express = require('express');
const router = express.Router();
const puppiesController = require('../controllers/puppies.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', puppiesController.listPuppies);
router.get('/new', puppiesController.getForm);
router.post('/save', puppiesController.savePuppy);
router.get('/edit/:id', puppiesController.getForm);
router.post('/save/:id', puppiesController.savePuppy);
router.get('/delete/:id', puppiesController.deletePuppy);

module.exports = router;
