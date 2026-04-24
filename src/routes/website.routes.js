const express = require('express');

const router = express.Router();

function renderPublic(req, res) {
  return res.status(200).render('website/public-site', {
    title: 'Site Élevage',
    user: null,
    slug: req.params.slug,
  });
}

router.get('/elevage/:slug', renderPublic);
router.get('/:slug', renderPublic);

module.exports = router;
