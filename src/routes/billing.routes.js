const express = require('express');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const billing = require('../services/billing.service');
const router = express.Router();
router.use(requireAuth, requireOwner);
router.get('/', async (req, res, next) => {
  try { res.render('billing/index', { title: 'Abonnement', billing: await billing.account(req.session.user.breeder_id), result: req.query.result }); }
  catch (error) { next(error); }
});
function redirectTo(action) {
  return async (req, res, next) => {
    try { res.redirect(303, await action(req.session.user)); }
    catch (error) {
      if (error.status) { req.session.flash = { type: 'error', message: error.message }; return res.redirect('/billing'); }
      return next(error);
    }
  };
}
router.post('/checkout', verifyCsrf, redirectTo(billing.checkout));
router.post('/portal', verifyCsrf, redirectTo(billing.portal));
module.exports = router;
