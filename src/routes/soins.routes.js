const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const soinsController = require('../controllers/soins.controller');

router.use(requireAuth);

router.get('/', soinsController.listSoins);
router.post('/new', soinsController.createSoin);

module.exports = router;