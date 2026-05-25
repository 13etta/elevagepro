const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const profitabilityController = require('../controllers/profitability.controller');

router.use(requireAuth);

router.get('/', profitabilityController.getProfitability);
router.post('/expenses', profitabilityController.addExpense);
router.post('/expenses/:id/delete', profitabilityController.deleteExpense);

module.exports = router;