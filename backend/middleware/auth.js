// Middleware de autenticação JWT
const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT no header Authorization: Bearer <token>.
 * Em caso de sucesso, anexa req.user = { id, role, unitId, email }.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:         payload.sub,
      role:       payload.role,
      unitId:     payload.unitId,
      contractId: payload.contractId || null,
      email:      payload.email,
    };
    next();
  } catch (err) {
    // Passa para o errorHandler central
    next(err);
  }
}

module.exports = authMiddleware;
