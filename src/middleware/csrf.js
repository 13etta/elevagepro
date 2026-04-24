const crypto = require('crypto');

function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function verifyCsrf(req, res, next) {
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).render('errors/403', {
      title: 'Action refusée',
      user: req.session.user,
    });
  }
  return next();
}

module.exports = {
  csrfToken,
  verifyCsrf,
};
