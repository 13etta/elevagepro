const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const settingsController = require('../controllers/settings.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.post('/', verifyCsrf, settingsController.updateSettings);
router.post('/preferences', verifyCsrf, settingsController.updatePreferences);
router.post('/logo', upload.single('logo'), verifyCsrf, settingsController.uploadLogo);
router.post('/website', upload.any(), verifyCsrf, settingsController.updateWebsiteSettings);

module.exports = router;
