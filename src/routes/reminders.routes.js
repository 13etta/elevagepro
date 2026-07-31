const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const remindersController = require('../controllers/reminders.controller');

const router = express.Router();

router.use(requireAuth);
router.use(verifyCsrf);

router.get('/', remindersController.listReminders);
router.get('/new', remindersController.getReminderForm);
router.post('/new', remindersController.saveReminder);
router.get('/:id/edit', remindersController.getReminderForm);
router.post('/:id/edit', remindersController.saveReminder);
router.post('/:id/complete', remindersController.completeReminder);
router.post('/:id/reopen', remindersController.reopenReminder);
router.post('/:id/delete', remindersController.deleteReminder);

module.exports = router;
