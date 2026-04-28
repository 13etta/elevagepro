const express = require('express');
const { requireAuth } = require('../middleware/auth');
const remindersController = require('../controllers/reminders.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', remindersController.listReminders);
router.get('/new', remindersController.getReminderForm);
router.post('/new', remindersController.saveReminder);
router.get('/:id/edit', remindersController.getReminderForm);
router.post('/:id/edit', remindersController.saveReminder);
router.get('/:id/complete', remindersController.completeReminder);
router.post('/:id/complete', remindersController.completeReminder);
router.get('/:id/reopen', remindersController.reopenReminder);
router.post('/:id/reopen', remindersController.reopenReminder);
router.get('/:id/delete', remindersController.deleteReminder);
router.post('/:id/delete', remindersController.deleteReminder);

module.exports = router;
