const express = require('express');
const router = express.Router();
const geneticsController = require('../controllers/genetics.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => res.redirect('/genetics/simulator'));
router.get('/simulator', geneticsController.getSimulator);
router.post('/simulator', geneticsController.runSimulation);

module.exports = router;
