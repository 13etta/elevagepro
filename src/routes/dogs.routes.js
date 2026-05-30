const express = require('express');
const router = express.Router();
const multer = require('multer');
const dogsController = require('../controllers/dogs.controller');
const { requireAuth } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Format de photo non supporte. Utilisez JPG, PNG ou WebP.'));
    }
    return cb(null, true);
  },
});

// Protection de toutes les routes de la section chiens
router.use(requireAuth);

// Affichage du registre (Liste globale)
router.get('/', dogsController.listDogs);

// Processus de création d'un nouveau chien
router.get('/new', dogsController.getForm);
router.post('/new', upload.single('photo'), dogsController.saveDog);

// Processus de modification d'un chien existant
router.get('/:id/edit', dogsController.getForm);
router.post('/:id/edit', upload.single('photo'), dogsController.saveDog);

// Sortie administrative du cheptel : aucune suppression physique en base
router.get('/:id/delete', dogsController.getDeleteForm);
router.post('/:id/delete', dogsController.deleteDog);

// Fiche détaillée d'un chien
router.get('/:id', dogsController.showDog);

module.exports = router;
