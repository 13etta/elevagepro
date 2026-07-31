const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const token = req.body?._csrf || req.headers['x-csrf-token'];
  const expectedToken = req.session?.csrfToken;
  const submitted = typeof token === 'string' ? Buffer.from(token) : null;
  const expected = typeof expectedToken === 'string' ? Buffer.from(expectedToken) : null;
  const valid = submitted
    && expected
    && submitted.length === expected.length
    && crypto.timingSafeEqual(submitted, expected);

  if (!valid) {
    if (req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Jeton de sécurité invalide ou expiré.' });
    }

    return res.status(403).render('errors/403', {
      title: 'Action refusée',
      user: req.session?.user || null,
    });
  }
  return next();
}

module.exports = {
  csrfToken,
  verifyCsrf,
};
