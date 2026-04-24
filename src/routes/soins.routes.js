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

module.exports = router;
