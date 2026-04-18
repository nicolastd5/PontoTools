const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const { list, markRead, markAllRead, remove, removeRead, send, subscribe, unsubscribe, saveFcmToken } = require('../controllers/notification.controller');
const auth = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

// Listagem
router.get('/', auth, list);

// Marcar uma como lida
router.patch('/:id/read', auth, markRead);

// Marcar todas como lidas
router.patch('/read-all', auth, markAllRead);

// Excluir notificações lidas
router.delete('/read', auth, removeRead);

// Excluir uma notificação
router.delete('/:id', auth, remove);

// Enviar notificação manual (admin/gestor)
router.post(
  '/send',
  auth,
  requireAdminOrGestor,
  body('title').notEmpty().withMessage('Título obrigatório.'),
  body('body').notEmpty().withMessage('Mensagem obrigatória.'),
  validate,
  send
);

// Registrar Web Push subscription
router.post('/subscribe', auth, subscribe);

// Remover subscription
router.delete('/subscribe', auth, unsubscribe);

// Salvar FCM token do dispositivo mobile
router.post('/fcm-token', auth, saveFcmToken);

module.exports = router;
