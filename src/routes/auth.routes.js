const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

const router = express.Router();

router.get('/login', requireGuest, authController.renderLogin);
router.post('/login', requireGuest, authController.login);
router.get('/register', requireGuest, authController.renderRegister);
router.post('/register', requireGuest, authController.register);
router.post('/logout', requireAuth, verifyCsrf, authController.logout);

module.exports = router;
