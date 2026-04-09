// Middleware de log de auditoria para ações administrativas
// Grava na tabela audit_logs toda mutação feita por admins
const db = require('../config/database');

/**
 * Fábrica de middleware de auditoria.
 * Uso: router.post('/employees', auth, requireAdmin, auditLog('EMPLOYEE_CREATED'), controller)
 *
 * @param {string} action      - nome da ação (ex: 'EMPLOYEE_CREATED', 'UNIT_UPDATED')
 * @param {string} targetType  - tipo do recurso afetado (ex: 'employee', 'unit')
 */
function auditLog(action, targetType = null) {
  return async (req, res, next) => {
    // Intercepta o res.json original para capturar o targetId da resposta
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Só loga se a operação foi bem-sucedida (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const targetId = body?.id || body?.data?.id || req.params?.id || null;

          await db.query(
            `INSERT INTO audit_logs (admin_id, action, target_type, target_id, new_value, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.user.id,
              action,
              targetType,
              targetId ? parseInt(targetId, 10) : null,
              body ? JSON.stringify(body) : null,
              req.ip,
            ]
          );
        } catch (logError) {
          // Falha no log de auditoria não deve quebrar a resposta
          console.error('Erro ao gravar audit log:', logError.message);
        }
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = auditLog;
