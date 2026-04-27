const express = require('express');
const router = express.Router();
const dogsController = require('../controllers/dogs.controller');
const { requireAuth } = require('../middleware/auth');

// Protection des routes
router.use(requireAuth);

// Lecture
router.get('/', dogsController.listDogs);

// Création
router.get('/new', dogsController.getCreateForm);
router.post('/new', dogsController.createDog);

// Modification
router.get('/:id/edit', dogsController.getEditForm);
router.post('/:id/edit', dogsController.updateDog);

// Suppression
router.post('/:id/delete', dogsController.deleteDog);

module.exports = router;