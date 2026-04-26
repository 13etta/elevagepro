const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSettings);

module.exports = router;