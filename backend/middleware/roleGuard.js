// Guards de role: restringem rotas por papel do usuário

/**
 * Bloqueia acesso a quem não for admin.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

/**
 * Permite acesso a qualquer usuário autenticado (admin ou employee).
 * Usado em conjunto com authMiddleware — garante apenas que req.user existe.
 */
function requireEmployee(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  next();
}

module.exports = { requireAdmin, requireEmployee };
