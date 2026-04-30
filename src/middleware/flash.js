function flashMiddleware(req, res, next) {
  const queuedFlash = req.session?.flash || [];
  res.locals.flashMessages = queuedFlash;

  if (req.session) {
    req.session.flash = [];

    req.flash = (type, message) => {
      if (!req.session.flash) req.session.flash = [];
      req.session.flash.push({ type, message });
    };
  } else {
    req.flash = () => {};
  }

  next();
}

module.exports = flashMiddleware;
