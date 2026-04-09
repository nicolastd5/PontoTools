const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller       = require('../controllers/contract.controller');
const auth             = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const validate         = require('../middleware/validate');
const auditLog         = require('../middleware/auditLogger');

router.use(auth, requireAdmin);

// GET /api/contracts
router.get('/', controller.list);

// POST /api/contracts
router.post('/',
  body('name').notEmpty().withMessage('Nome do contrato obrigatório.'),
  body('code').notEmpty().withMessage('Código do contrato obrigatório.'),
  validate,
  auditLog('CONTRACT_CREATED', 'contract'),
  controller.create
);

// PUT /api/contracts/:id
router.put('/:id',
  auditLog('CONTRACT_UPDATED', 'contract'),
  controller.update
);

// DELETE /api/contracts/:id
router.delete('/:id',
  auditLog('CONTRACT_DEACTIVATED', 'contract'),
  controller.deactivate
);

module.exports = router;
