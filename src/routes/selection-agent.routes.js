const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const controller = require('../controllers/selection-agent.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      return callback(new Error('Le pedigree doit être fourni au format PDF.'));
    }
    return callback(null, true);
  },
});

function uploadPedigree(req, res, next) {
  upload.single('pedigree')(req, res, (error) => {
    if (!error) return next();
    req.session.flash = {
      type: 'error',
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Le PDF dépasse la limite de 20 Mo.'
        : error.message,
    };
    return res.redirect('/selection-agent');
  });
}

router.use(requireAuth);
router.get('/', controller.index);
router.post('/analyze', uploadPedigree, verifyCsrf, controller.analyze);
router.get('/:id', controller.show);
router.post('/:id/validate', verifyCsrf, controller.validate);
router.post('/:id/research', verifyCsrf, controller.research);

module.exports = router;
