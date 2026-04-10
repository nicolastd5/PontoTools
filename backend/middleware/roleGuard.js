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
 * Permite acesso a admin ou gestor.
 */
function requireAdminOrGestor(req, res, next) {
  if (!['admin', 'gestor'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Acesso restrito a administradores e gestores.' });
  }
  next();
}

/**
 * Permite acesso a qualquer usuário autenticado (admin ou employee).
 */
function requireEmployee(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  next();
}

module.exports = { requireAdmin, requireAdminOrGestor, requireEmployee };
