const express  = require('express');
const multer   = require('multer');
const { body } = require('express-validator');
const router   = express.Router();

const controller            = require('../controllers/employee.controller');
const auth                  = require('../middleware/auth');
const { requireAdmin, requireAdminOrGestor } = require('../middleware/roleGuard');
const validate              = require('../middleware/validate');
const auditLog              = require('../middleware/auditLogger');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(auth, requireAdminOrGestor);

// GET /api/employees
router.get('/', controller.list);

// GET /api/employees/template
router.get('/template', controller.downloadTemplate);

// POST /api/employees
router.post('/',
  body('unit_id').isInt({ min: 1 }).withMessage('Unidade inválida.'),
  body('badge_number').notEmpty().withMessage('Matrícula obrigatória.'),
  body('full_name').notEmpty().withMessage('Nome completo obrigatório.'),
  body('email').isEmail().withMessage('Email inválido.'),
  body('password').isLength({ min: 6 }).withMessage('Senha mínima de 6 caracteres.'),
  validate,
  auditLog('EMPLOYEE_CREATED', 'employee'),
  controller.create
);

// POST /api/employees/import — apenas admin
router.post('/import', requireAdmin, upload.single('file'), auditLog('EMPLOYEES_IMPORTED', 'employee'), controller.importEmployees);

// GET /api/employees/:id
router.get('/:id', controller.getById);

// PUT /api/employees/:id
router.put('/:id', auditLog('EMPLOYEE_UPDATED', 'employee'), controller.update);

// PATCH /api/employees/:id/active
router.patch('/:id/active', auditLog('EMPLOYEE_TOGGLED', 'employee'), controller.toggleActive);

// DELETE /api/employees/:id — apenas admin
router.delete('/:id', requireAdmin, auditLog('EMPLOYEE_DELETED', 'employee'), controller.deleteEmployee);

// PATCH /api/employees/:id/reset-password — apenas admin
router.patch('/:id/reset-password',
  requireAdmin,
  body('newPassword').isLength({ min: 6 }).withMessage('Senha mínima de 6 caracteres.'),
  validate,
  auditLog('EMPLOYEE_PASSWORD_RESET', 'employee'),
  controller.resetPasswordByAdmin
);

module.exports = router;
