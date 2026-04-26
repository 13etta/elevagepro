const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { requireAuth } = require('../middleware/auth');

// Protection globale du module (authentification obligatoire)
router.use(requireAuth);

// ATTENTION : Ici on utilise '/' car le préfixe '/sales' est déjà géré par app.js
router.get('/', salesController.listSales);           // Gère l'URL /sales
router.get('/new', salesController.getSaleForm);       // Gère l'URL /sales/new
router.post('/', salesController.createSale);          // Gère l'envoi du formulaire
router.get('/:id/document/:type', salesController.downloadDocument); // Gère les PDF

module.exports = router;