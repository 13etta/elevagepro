const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const dogsController = require('../controllers/dogs.controller');

// Toutes les routes chiens sont protégées
router.use(requireAuth);

router.get('/', dogsController.listDogs);
router.get('/new', dogsController.getCreateForm);
router.post('/new', dogsController.createDog);
router.get('/:id/edit', dogsController.getEditForm);
router.get('/:id', dogsController.getDogDetails);

module.exports = router;