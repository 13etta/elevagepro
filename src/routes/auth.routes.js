router.get('/login', requireGuest, authController.renderLogin);
router.post('/login', requireGuest, authController.login);
router.get('/register', requireGuest, authController.renderRegister);
router.post('/register', requireGuest, authController.register);
router.post('/logout', requireAuth, verifyCsrf, authController.logout);
