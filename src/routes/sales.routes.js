const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const salesController = require('../controllers/sales.controller');

router.use(requireAuth);

router.get('/', salesController.listSales);
router.post('/new', salesController.createSale);
router.get('/:id/document/:type', salesController.downloadDocument);
router.get('/new', salesController.getSaleForm);

module.exports = router;