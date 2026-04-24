function requireAuth(req, res, next) {
  if (!req.session?.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  return next();
}

function requireGuest(req, res, next) {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = {
  requireAuth,
  requireGuest,
};
