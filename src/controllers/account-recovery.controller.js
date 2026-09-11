const recovery = require('../services/account-recovery.service');
function render(req, res, mode, message = null, status = 200) {
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cache-Control', 'no-store');
  return res.status(status).render('auth/recovery', { title: 'Accès au compte', mode, message,
    token: typeof req.query.token === 'string' ? req.query.token : '', user: null });
}
exports.forgotForm = (req, res) => render(req, res, 'forgot');
exports.resetForm = (req, res) => render(req, res, 'reset');
exports.requestReset = async (req, res, next) => {
  try {
    await recovery.requestReset(req.body.email);
    return render(req, res, 'forgot', 'Si un compte actif correspond à cet email, un lien vous sera envoyé. Pensez à vérifier les courriers indésirables.');
  } catch (error) {
    if (error.status) return render(req, res, 'forgot', error.message, error.status);
    // Never log a transporter error: it can contain a recovery link or an address.
    console.error('account.recovery_delivery_failed');
    return render(req, res, 'forgot', 'Si un compte actif correspond à cet email, un lien vous sera envoyé. Pensez à vérifier les courriers indésirables.');
  }
};
exports.reset = async (req, res, next) => {
  try {
    if (!await recovery.resetPassword(req.body.token, req.body.password)) return render(req, res, 'forgot', 'Lien expiré ou mot de passe invalide (12 caractères minimum, 72 octets maximum). Demandez un nouveau lien.', 400);
    if (req.session) await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('sid');
    return res.redirect('/auth/login');
  } catch (error) { return next(error); }
};
