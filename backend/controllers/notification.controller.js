const db   = require('../config/database');
const push = require('../services/push.service');

// ----------------------------------------------------------------
// GET /api/notifications
// Employee: suas notificações. Admin/gestor: filtra por employee
// ----------------------------------------------------------------
async function list(req, res, next) {
  try {
    const params  = [];
    const filters = [];

    if (req.user.role === 'employee') {
      params.push(req.user.id);
      filters.push(`n.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(parseInt(req.query.employeeId, 10));
      filters.push(`n.employee_id = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT n.id, n.title, n.body, n.type, n.read, n.push_sent, n.created_at,
              e.name AS employee_name
       FROM notifications n
       JOIN employees e ON e.id = n.employee_id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT 100`,
      params
    );

    const unread = result.rows.filter((r) => !r.read).length;
    res.json({ notifications: result.rows, unread });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/notifications/:id/read
// ----------------------------------------------------------------
async function markRead(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND employee_id = $2
       RETURNING id, read`,
      [id, req.user.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Notificação não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/notifications/read-all
// ----------------------------------------------------------------
async function markAllRead(req, res, next) {
  try {
    await db.query(
      `UPDATE notifications SET read = TRUE WHERE employee_id = $1 AND read = FALSE`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/notifications/send
// Admin/gestor envia notificação manual
// ----------------------------------------------------------------
async function send(req, res, next) {
  try {
    const { employee_id, unit_id, title, body } = req.body;

    // Destinatários
    let employeeIds = [];

    if (employee_id) {
      employeeIds = [parseInt(employee_id, 10)];
    } else if (unit_id) {
      // Todos da unidade
      const result = await db.query(
        `SELECT id FROM employees WHERE unit_id = $1 AND active = TRUE`, [unit_id]
      );
      employeeIds = result.rows.map((r) => r.id);
    } else {
      return res.status(400).json({ error: 'Informe employee_id ou unit_id.' });
    }

    await Promise.all(employeeIds.map((eid) => push.notify(eid, title, body, 'manual')));

    res.json({ sent: employeeIds.length });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/notifications/subscribe
// Registra subscription de Web Push
// ----------------------------------------------------------------
async function subscribe(req, res, next) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Subscription inválida.' });
    }

    await db.query(
      `INSERT INTO push_subscriptions (employee_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET employee_id = $1, p256dh = $3, auth = $4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/notifications/subscribe
// ----------------------------------------------------------------
async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body;
    await db.query(
      `DELETE FROM push_subscriptions WHERE employee_id = $1 AND endpoint = $2`,
      [req.user.id, endpoint]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markRead, markAllRead, send, subscribe, unsubscribe };
