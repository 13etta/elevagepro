const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const healthTestsController = require('../controllers/health-tests.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Format justificatif non supporté. Utilisez PDF, JPG, PNG ou WebP.'));
    }
    return cb(null, true);
  },
});

router.use(requireAuth);

router.get('/', healthTestsController.listHealthTests);
router.post('/', upload.single('certificate'), healthTestsController.createHealthTest);
router.post('/:id/delete', healthTestsController.deleteHealthTest);

module.exports = router;
