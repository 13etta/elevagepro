const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const geneticsController = require('../controllers/genetics.controller');

router.use(requireAuth);

router.get('/simulator', geneticsController.getSimulator);
router.post('/simulator', geneticsController.runSimulation);

module.exports = router;