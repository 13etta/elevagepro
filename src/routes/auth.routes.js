const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const { loginIpLimit, loginAccountLimit, registrationLimit, recoveryLimit } = require('../middleware/rate-limit');
const recovery = require('../controllers/account-recovery.controller');
const router = express.Router();

router.get('/login', requireGuest, authController.renderLogin);
router.post('/login', requireGuest, loginIpLimit, loginAccountLimit, verifyCsrf, authController.login);
router.get('/register', requireGuest, authController.renderRegister);
router.post('/register', requireGuest, registrationLimit, verifyCsrf, authController.register);
router.post('/logout', requireAuth, verifyCsrf, authController.logout);
router.get('/forgot-password', recovery.forgotForm);
router.post('/forgot-password', recoveryLimit, verifyCsrf, recovery.requestReset);
router.get('/reset-password', recovery.resetForm);
router.post('/reset-password', recoveryLimit, verifyCsrf, recovery.reset);

module.exports = router;
