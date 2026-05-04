const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSettings);
router.post('/preferences', settingsController.updatePreferences);
router.post('/logo', upload.single('logo'), settingsController.uploadLogo);
router.post('/website', upload.any(), settingsController.updateWebsiteSettings);

module.exports = router;
