const router = require('express').Router();
const controller = require('../controllers/training.controller');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
router.use(requireAuth);
router.use(verifyCsrf);
router.get('/',controller.list);
router.get('/new',controller.form);
router.post('/',controller.create);
router.get('/:id',controller.show);
router.get('/:id/quote.pdf',controller.printQuote);
router.get('/:id/edit',controller.form);
router.post('/:id/edit',controller.update);
router.post('/:id/accept',controller.accept);
router.post('/:id/payments',controller.pay);
router.post('/:id/close',controller.close);
// Numbering and immutable snapshot are mutations: issue documents through CSRF-protected POST.
router.post('/:id/documents/:kind',controller.document);
module.exports = router;
