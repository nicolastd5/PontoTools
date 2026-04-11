const express  = require('express');
const multer   = require('multer');
const { body } = require('express-validator');
const router   = express.Router();

const controller               = require('../controllers/service.controller');
const auth                     = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                 = require('../middleware/validate');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    cb(null, true);
  },
});

// Listagem — qualquer autenticado (employee vê só os seus)
router.get('/', auth, controller.list);

// Criação — apenas admin/gestor
router.post('/',
  auth,
  requireAdminOrGestor,
  body('title').notEmpty().withMessage('Título obrigatório.'),
  body('assigned_employee_id').isInt().withMessage('Funcionário obrigatório.'),
  body('scheduled_date').isDate().withMessage('Data inválida.'),
  validate,
  controller.create
);

// Detalhe
router.get('/:id', auth, controller.getOne);

// Atualizar status (funcionário ou admin/gestor)
router.patch('/:id/status',
  auth,
  body('status').isIn(['in_progress','done','problem']).withMessage('Status inválido.'),
  validate,
  controller.updateStatus
);

// Upload de foto
router.post('/:id/photos',
  auth,
  upload.single('photo'),
  body('phase').isIn(['before','after']).withMessage('Fase inválida.'),
  validate,
  controller.addPhoto
);

// Servir foto
router.get('/:id/photos/:photoId', auth, controller.getPhoto);

// Deletar foto — apenas admin/gestor
router.delete('/:id/photos/:photoId', auth, requireAdminOrGestor, controller.deletePhoto);

// Reagendar — apenas admin/gestor
router.patch('/:id/reschedule',
  auth,
  requireAdminOrGestor,
  body('scheduled_date').isDate().withMessage('Data inválida.'),
  validate,
  controller.reschedule
);

// Deletar serviço — apenas admin/gestor
router.delete('/:id', auth, requireAdminOrGestor, controller.deleteService);

module.exports = router;
