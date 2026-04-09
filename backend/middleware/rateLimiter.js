// Configurações de rate limiting
const rateLimit = require('express-rate-limit');

/**
 * Limita tentativas de login: 5 por IP a cada 15 minutos.
 * Protege contra ataques de força bruta.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
  },
  // Chave por IP (comportamento padrão)
  keyGenerator: (req) => req.ip,
});

/**
 * Limita batidas de ponto: 10 por usuário autenticado por minuto.
 * Protege contra replay attacks e submissões duplicadas.
 */
const clockLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_CLOCK_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de batida de ponto. Aguarde um minuto.',
  },
  // Chave por ID do usuário autenticado (mais preciso que por IP)
  keyGenerator: (req) => (req.user?.id ? `user_${req.user.id}` : req.ip),
});

module.exports = { loginLimiter, clockLimiter };
