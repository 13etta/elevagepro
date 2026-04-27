const express = require('express');
const router = express.Router();
const dogsController = require('../controllers/dogs.controller');
const { requireAuth } = require('../middleware/auth');

// Protection de toutes les routes du module
router.use(requireAuth);

// Liste et filtres
router.get('/', dogsController.listDogs);

// Création d'un chien
router.get('/new', dogsController.getCreateForm);
router.post('/new', dogsController.createDog);

// Édition d'un chien
router.get('/:id/edit', dogsController.getEditForm);
router.post('/:id/edit', dogsController.updateDog); // La route qui corrige ton erreur 404

// Suppression
router.post('/:id/delete', dogsController.deleteDog);

module.exports = router;