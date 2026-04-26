const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

// Configuration de Multer pour garder le fichier en mémoire RAM
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSettings);

// Nouvelle route avec le middleware Multer qui cible le champ nommé "logo"
router.post('/logo', upload.single('logo'), settingsController.uploadLogo);

module.exports = router;