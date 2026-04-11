const express  = require('express');
const multer   = require('multer');
const { body } = require('express-validator');
const router   = express.Router();

const controller          = require('../controllers/clock.controller');
const auth                = require('../middleware/auth');
const validate            = require('../middleware/validate');
const { clockLimiter }    = require('../middleware/rateLimiter');

// Multer: foto apenas em memória (não salva em disco diretamente)
// O photoStorage.service decide onde gravar
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido. Use JPEG ou PNG.'));
    }
    cb(null, true);
  },
});

// POST /api/clock — bate ponto (aceita até 5 fotos)
router.post('/',
  auth,
  clockLimiter,
  upload.array('photo', 5),
  body('clock_type').isIn(['entry', 'exit', 'break_start', 'break_end'])
    .withMessage('Tipo de batida inválido.'),
  body('latitude').isFloat({ min: -90, max: 90 })
    .withMessage('Latitude inválida.'),
  body('longitude').isFloat({ min: -180, max: 180 })
    .withMessage('Longitude inválida.'),
  body('timezone').notEmpty()
    .withMessage('Fuso horário obrigatório.'),
  validate,
  controller.registerClock
);

// GET /api/clock/history
router.get('/history', auth, controller.getHistory);

// GET /api/clock/today
router.get('/today', auth, controller.getToday);

module.exports = router;
