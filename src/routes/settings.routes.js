const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const settingsController = require('../controllers/settings.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 24, fields: 200, parts: 224 } });

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.post('/', requireOwner, verifyCsrf, settingsController.updateSettings);
router.post('/preferences', verifyCsrf, settingsController.updatePreferences);
router.post('/logo', requireOwner, upload.single('logo'), verifyCsrf, settingsController.uploadLogo);
router.post('/website', requireOwner, upload.any(), verifyCsrf, settingsController.updateWebsiteSettings);

module.exports = router;
