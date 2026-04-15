const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller = require('../controllers/notification.controller');
const auth = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

// Listagem
router.get('/', auth, controller.list);

// Marcar uma como lida
router.patch('/:id/read', auth, controller.markRead);

// Marcar todas como lidas
router.patch('/read-all', auth, controller.markAllRead);

// Excluir notificações lidas
router.delete('/read', auth, controller.removeRead);

// Excluir uma notificação
router.delete('/:id', auth, controller.remove);

// Enviar notificação manual (admin/gestor)
router.post(
  '/send',
  auth,
  requireAdminOrGestor,
  body('title').notEmpty().withMessage('Título obrigatório.'),
  body('body').notEmpty().withMessage('Mensagem obrigatória.'),
  validate,
  controller.send
);

// Registrar Web Push subscription
router.post('/subscribe', auth, controller.subscribe);

// Remover subscription
router.delete('/subscribe', auth, controller.unsubscribe);

module.exports = router;
