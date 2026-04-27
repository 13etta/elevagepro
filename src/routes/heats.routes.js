const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.status(501).render('coming-soon', {
    title: 'Module en préparation',
    user: req.session.user,
    moduleName: req.baseUrl.replace('/', ''),
  });
});
const express = require('express');
const router = express.Router();
const heatsController = require('../controllers/heats.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', heatsController.listHeats);
router.get('/new', heatsController.getCreateForm);
router.post('/new', heatsController.createHeat);
router.get('/:id/edit', heatsController.getEditForm);
router.post('/:id/edit', heatsController.updateHeat);
router.post('/:id/delete', heatsController.deleteHeat);

module.exports = router;
module.exports = router;
