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

module.exports = router;
