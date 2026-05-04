const express = require('express');
const router = express.Router();
const dogsController = require('../controllers/dogs.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', dogsController.listDogs);

router.get('/new', dogsController.getCreateForm);
router.post('/new', dogsController.createDog);

router.get('/:id/edit', dogsController.getEditForm);
router.post('/:id/edit', dogsController.updateDog);

router.get('/:id', dogsController.showDog);

router.post('/:id/delete', dogsController.deleteDog);

module.exports = router;
