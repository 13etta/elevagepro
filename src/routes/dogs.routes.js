const express = require('express');
const router = express.Router();
const dogsController = require('../controllers/dogs.controller');
const { requireAuth } = require('../middleware/auth');

// Protection de toutes les routes de la section chiens
router.use(requireAuth);

// Affichage du registre (Liste globale)
router.get('/', dogsController.listDogs);

// Processus de création d'un nouveau chien
router.get('/new', dogsController.getForm);
router.post('/new', dogsController.saveDog);

// Processus de modification d'un chien existant
router.get('/:id/edit', dogsController.getForm);
router.post('/:id/edit', dogsController.saveDog);

// Processus de suppression
router.post('/:id/delete', dogsController.deleteDog);

module.exports = router;