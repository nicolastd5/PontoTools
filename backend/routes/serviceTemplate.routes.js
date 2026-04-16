const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller               = require('../controllers/serviceTemplate.controller');
const auth                     = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                 = require('../middleware/validate');

// Listagem
router.get('/', auth, requireAdminOrGestor, controller.list);

// Criação
router.post('/',
  auth,
  requireAdminOrGestor,
  body('title').notEmpty().withMessage('Título obrigatório.'),
  body('unit_id').isInt({ min: 1 }).withMessage('Posto obrigatório.'),
  body('interval_days').isInt({ min: 1 }).withMessage('Intervalo mínimo de 1 dia.'),
  body('start_date').isDate().withMessage('Data de início inválida.'),
  validate,
  controller.create
);

// Edição
router.patch('/:id',
  auth,
  requireAdminOrGestor,
  body('title').optional().notEmpty().withMessage('Título não pode ser vazio.'),
  body('interval_days').optional().isInt({ min: 1 }).withMessage('Intervalo mínimo de 1 dia.'),
  body('start_date').optional().isDate().withMessage('Data inválida.'),
  validate,
  controller.update
);

// Ativar/Pausar
router.patch('/:id/toggle', auth, requireAdminOrGestor, controller.toggle);

// Deletar
router.delete('/:id', auth, requireAdminOrGestor, controller.remove);

module.exports = router;
