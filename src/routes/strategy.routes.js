const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const strategyController = require('../controllers/strategy.controller');

router.use(requireAuth);

router.get('/', strategyController.getStrategy);
router.post('/', strategyController.runStrategy);

module.exports = router;
