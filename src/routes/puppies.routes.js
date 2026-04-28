const express = require('express');
const router = express.Router();
const puppiesController = require('../controllers/puppies.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', puppiesController.listPuppies);

router.get('/new', puppiesController.getForm);
router.post('/new', puppiesController.savePuppy);
router.post('/save', puppiesController.savePuppy);

router.get('/edit/:id', puppiesController.getForm);
router.post('/save/:id', puppiesController.savePuppy);
router.get('/delete/:id', puppiesController.deletePuppy);

router.get('/:id/edit', puppiesController.getForm);
router.post('/:id/edit', puppiesController.savePuppy);
router.get('/:id/delete', puppiesController.deletePuppy);
router.post('/:id/delete', puppiesController.deletePuppy);

router.get('/:id', puppiesController.showPuppy);

module.exports = router;
