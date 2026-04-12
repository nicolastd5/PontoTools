const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller                         = require('../controllers/contract.controller');
const auth                               = require('../middleware/auth');
const { requireAdmin, requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                           = require('../middleware/validate');
const auditLog                           = require('../middleware/auditLogger');

router.use(auth, requireAdminOrGestor);

// GET /api/contracts — admin vê todos, gestor vê só o seu
router.get('/', controller.list);

// POST /api/contracts — apenas admin
router.post('/',
  requireAdmin,
  body('name').notEmpty().withMessage('Nome do contrato obrigatório.'),
  body('code').notEmpty().withMessage('Código do contrato obrigatório.'),
  validate,
  auditLog('CONTRACT_CREATED', 'contract'),
  controller.create
);

// PUT /api/contracts/:id — apenas admin
router.put('/:id',
  requireAdmin,
  auditLog('CONTRACT_UPDATED', 'contract'),
  controller.update
);

// DELETE /api/contracts/:id — apenas admin (desativa)
router.delete('/:id',
  requireAdmin,
  auditLog('CONTRACT_DEACTIVATED', 'contract'),
  controller.deactivate
);

// DELETE /api/contracts/:id/destroy — apenas admin (exclusão permanente)
router.delete('/:id/destroy',
  requireAdmin,
  auditLog('CONTRACT_DELETED', 'contract'),
  controller.destroy
);

module.exports = router;
