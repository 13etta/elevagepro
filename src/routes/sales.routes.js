const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', salesController.listSales);
router.get('/new', salesController.getSaleForm);
router.post('/', salesController.createSale);
router.get('/:id/edit', salesController.getEditSaleForm);
router.post('/:id/edit', salesController.updateSale);
router.get('/:id/document/:type', salesController.downloadDocument);

module.exports = router;
