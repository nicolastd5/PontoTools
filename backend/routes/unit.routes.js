const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller       = require('../controllers/unit.controller');
const auth             = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const validate         = require('../middleware/validate');
const auditLog         = require('../middleware/auditLogger');

// GET /api/units — acessível para todos os usuários autenticados
router.get('/', auth, controller.list);

// Rotas abaixo: apenas admin
router.post('/',
  auth, requireAdmin,
  body('name').notEmpty().withMessage('Nome da unidade obrigatório.'),
  body('code').notEmpty().withMessage('Código da unidade obrigatório.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude inválida.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude inválida.'),
  validate,
  auditLog('UNIT_CREATED', 'unit'),
  controller.create
);

router.put('/:id',
  auth, requireAdmin,
  auditLog('UNIT_UPDATED', 'unit'),
  controller.update
);

router.delete('/:id',
  auth, requireAdmin,
  auditLog('UNIT_DEACTIVATED', 'unit'),
  controller.deactivate
);

module.exports = router;
