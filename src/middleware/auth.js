const { canAccessAiSelectionAgent } = require('../config/ai-selection-access');

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  return next();
}

function requireAiSelectionOwner(req, res, next) {
  if (canAccessAiSelectionAgent(req.session?.user)) {
    return next();
  }

  return res.status(404).render('errors/404', {
    title: res.__('errors.notFound'),
    user: req.session?.user || null,
  });
}

function requireGuest(req, res, next) {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = {
  requireAuth,
  requireAiSelectionOwner,
  requireGuest,
};
