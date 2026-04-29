const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const profitabilityController = require('../controllers/profitability.controller');

router.use(requireAuth);

router.get('/', profitabilityController.getProfitability);
router.post('/expenses', profitabilityController.addExpense);

module.exports = router;
