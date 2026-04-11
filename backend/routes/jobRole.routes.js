const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller = require('../controllers/jobRole.controller');
const auth       = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const validate   = require('../middleware/validate');
const auditLog   = require('../middleware/auditLogger');

router.use(auth, requireAdmin);

// GET /api/job-roles
router.get('/', controller.list);

// POST /api/job-roles
router.post('/',
  body('name').notEmpty().withMessage('Nome do cargo obrigatório.'),
  body('has_break').optional().isBoolean().withMessage('has_break deve ser booleano.'),
  validate,
  auditLog('JOB_ROLE_CREATED', 'job_role'),
  controller.create
);

// PUT /api/job-roles/:id
router.put('/:id',
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio.'),
  body('has_break').optional().isBoolean().withMessage('has_break deve ser booleano.'),
  validate,
  auditLog('JOB_ROLE_UPDATED', 'job_role'),
  controller.update
);

// PATCH /api/job-roles/:id/active
router.patch('/:id/active',
  auditLog('JOB_ROLE_TOGGLED', 'job_role'),
  controller.toggleActive
);

module.exports = router;
