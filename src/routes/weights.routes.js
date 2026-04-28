const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const weightsController = require('../controllers/weights.controller');

router.use(requireAuth);

router.get('/', weightsController.listWeights);
router.post('/', weightsController.addWeight);

module.exports = router;
