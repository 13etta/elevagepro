const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const calendarController = require('../controllers/calendar.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', calendarController.listEvents);
router.get('/new', calendarController.getEventForm);
router.post('/new', verifyCsrf, calendarController.saveEvent);
router.get('/:id/edit', calendarController.getEventForm);
router.post('/:id/edit', verifyCsrf, calendarController.saveEvent);
router.post('/:id/delete', verifyCsrf, calendarController.deleteEvent);

module.exports = router;
