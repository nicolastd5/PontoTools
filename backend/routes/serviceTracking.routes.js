const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller               = require('../controllers/serviceTracking.controller');
const auth                     = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                 = require('../middleware/validate');

router.post('/location',
  auth,
  body('service_order_id').isInt({ min: 1 }).withMessage('Servico invalido.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalida.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalida.'),
  body('accuracy_meters')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 10000 }).withMessage('Precisao invalida.'),
  body('source')
    .optional({ values: 'falsy' })
    .isIn(['web', 'mobile']).withMessage('Origem invalida.'),
  body('recorded_at')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Data invalida.'),
  validate,
  controller.postLocation
);

router.get('/live',
  auth,
  requireAdminOrGestor,
  controller.listLive
);

module.exports = router;
