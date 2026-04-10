const express    = require('express');
const { body }   = require('express-validator');
const router     = express.Router();
const controller = require('../controllers/auth.controller');
const auth       = require('../middleware/auth');
const validate   = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  body('email').isEmail().withMessage('Email inválido.'),
  body('password').notEmpty().withMessage('Senha obrigatória.'),
  validate,
  controller.login
);

// POST /api/auth/refresh
router.post('/refresh', controller.refresh);

// POST /api/auth/logout
router.post('/logout', auth, controller.logout);

// GET /api/auth/me
router.get('/me', auth, controller.me);

// PUT /api/auth/profile
router.put('/profile',
  auth,
  body('currentPassword').notEmpty().withMessage('Senha atual obrigatória.'),
  validate,
  controller.updateProfile
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  loginLimiter,
  body('email').isEmail().withMessage('Email inválido.'),
  validate,
  controller.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  body('token').notEmpty().withMessage('Token obrigatório.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),
  validate,
  controller.resetPassword
);

module.exports = router;
