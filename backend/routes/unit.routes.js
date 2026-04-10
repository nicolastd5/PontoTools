const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller                             = require('../controllers/unit.controller');
const auth                                   = require('../middleware/auth');
const { requireAdmin, requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                               = require('../middleware/validate');
const auditLog                               = require('../middleware/auditLogger');

// GET /api/units — acessível para todos os usuários autenticados
router.get('/', auth, controller.list);

// GET /api/units/:id — obter unidade pelo ID
router.get('/:id', auth, controller.getOne);

// POST — gestor pode criar posto (dentro do contrato dele)
router.post('/',
  auth, requireAdminOrGestor,
  body('name').notEmpty().withMessage('Nome da unidade obrigatório.'),
  body('code').notEmpty().withMessage('Código da unidade obrigatório.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude inválida.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude inválida.'),
  validate,
  auditLog('UNIT_CREATED', 'unit'),
  controller.create
);

// PUT — gestor pode editar posto
router.put('/:id',
  auth, requireAdminOrGestor,
  auditLog('UNIT_UPDATED', 'unit'),
  controller.update
);

// DELETE — apenas admin
router.delete('/:id',
  auth, requireAdmin,
  auditLog('UNIT_DEACTIVATED', 'unit'),
  controller.deactivate
);

module.exports = router;
