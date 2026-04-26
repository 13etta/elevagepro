const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const littersController = require('../controllers/litters.controller');

router.use(requireAuth);

router.get('/', littersController.listLitters);
router.post('/new', littersController.createLitter);

module.exports = router;