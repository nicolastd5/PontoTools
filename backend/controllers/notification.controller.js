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
    } else if (req.user.role === 'gestor') {
      // Gestor só vê notificações de funcionários do próprio contrato
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
      if (req.query.employeeId) {
        params.push(parseInt(req.query.employeeId, 10));
        filters.push(`n.employee_id = $${params.length}`);
      }
    } else if (req.query.employeeId) {
      params.push(parseInt(req.query.employeeId, 10));
      filters.push(`n.employee_id = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT n.id, n.title, n.body, n.type, n.read, n.push_sent, n.created_at,
              e.full_name AS employee_name
       FROM notifications n
       JOIN employees e ON e.id = n.employee_id
       JOIN units u ON u.id = e.unit_id
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

    // Admin/gestor podem marcar qualquer notificação; employee só as suas
    const result = req.user.role === 'employee'
      ? await db.query(
          `UPDATE notifications SET read = TRUE
           WHERE id = $1 AND employee_id = $2
           RETURNING id, read`,
          [id, req.user.id]
        )
      : await db.query(
          `UPDATE notifications SET read = TRUE
           WHERE id = $1
           RETURNING id, read`,
          [id]
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
    if (req.user.role === 'employee') {
      await db.query(
        `UPDATE notifications SET read = TRUE WHERE employee_id = $1 AND read = FALSE`,
        [req.user.id]
      );
    } else if (req.user.role === 'gestor') {
      // Gestor marca todas do próprio contrato
      await db.query(
        `UPDATE notifications n SET read = TRUE
         FROM employees e JOIN units u ON u.id = e.unit_id
         WHERE n.employee_id = e.id AND u.contract_id = $1 AND n.read = FALSE`,
        [req.user.contractId]
      );
    } else {
      // Admin marca todas
      await db.query(`UPDATE notifications SET read = TRUE WHERE read = FALSE`);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/notifications/:id
// ----------------------------------------------------------------
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    let result;

    if (req.user.role === 'employee') {
      result = await db.query(
        `DELETE FROM notifications
         WHERE id = $1 AND employee_id = $2
         RETURNING id`,
        [id, req.user.id]
      );
    } else if (req.user.role === 'gestor') {
      result = await db.query(
        `DELETE FROM notifications n
         USING employees e, units u
         WHERE n.id = $1
           AND n.employee_id = e.id
           AND e.unit_id = u.id
           AND u.contract_id = $2
         RETURNING n.id`,
        [id, req.user.contractId]
      );
    } else {
      result = await db.query(
        `DELETE FROM notifications
         WHERE id = $1
         RETURNING id`,
        [id]
      );
    }

    if (!result.rows[0]) return res.status(404).json({ error: 'Notificação não encontrada.' });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/notifications/read
// ----------------------------------------------------------------
async function removeRead(req, res, next) {
  try {
    let result;

    if (req.user.role === 'employee') {
      result = await db.query(
        `DELETE FROM notifications
         WHERE employee_id = $1 AND read = TRUE
         RETURNING id`,
        [req.user.id]
      );
    } else if (req.user.role === 'gestor') {
      result = await db.query(
        `DELETE FROM notifications n
         USING employees e, units u
         WHERE n.employee_id = e.id
           AND e.unit_id = u.id
           AND u.contract_id = $1
           AND n.read = TRUE
         RETURNING n.id`,
        [req.user.contractId]
      );
    } else {
      result = await db.query(
        `DELETE FROM notifications
         WHERE read = TRUE
         RETURNING id`
      );
    }

    res.json({ ok: true, deleted: result.rowCount });
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

    let employeeIds = [];

    if (employee_id) {
      const eid = parseInt(employee_id, 10);
      if (req.user.role === 'gestor') {
        const check = await db.query(
          `SELECT e.id FROM employees e JOIN units u ON u.id = e.unit_id
           WHERE e.id = $1 AND u.contract_id = $2`,
          [eid, req.user.contractId]
        );
        if (!check.rows[0]) return res.status(403).json({ error: 'Acesso negado.' });
      }
      employeeIds = [eid];
    } else if (unit_id) {
      const uid = parseInt(unit_id, 10);
      if (req.user.role === 'gestor') {
        const check = await db.query(
          `SELECT id FROM units WHERE id = $1 AND contract_id = $2`,
          [uid, req.user.contractId]
        );
        if (!check.rows[0]) return res.status(403).json({ error: 'Acesso negado.' });
      }
      const result = await db.query(
        `SELECT id FROM employees WHERE unit_id = $1 AND active = TRUE`,
        [uid]
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

// ----------------------------------------------------------------
// POST /api/notifications/subscribe-fcm
// Registra ou atualiza token FCM do funcionário (app nativo)
// ----------------------------------------------------------------
async function subscribeFcm(req, res, next) {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) return res.status(400).json({ error: 'fcm_token obrigatório.' });

    const existing = await db.query(
      `SELECT id FROM push_subscriptions
       WHERE employee_id = $1 AND (endpoint IS NULL OR endpoint = '')`,
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE push_subscriptions SET fcm_token = $1 WHERE id = $2`,
        [fcm_token, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO push_subscriptions (employee_id, fcm_token, endpoint, p256dh, auth)
         VALUES ($1, $2, NULL, NULL, NULL)`,
        [req.user.id, fcm_token]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/notifications/subscribe-fcm
// Remove token FCM do funcionário
// ----------------------------------------------------------------
async function unsubscribeFcm(req, res, next) {
  try {
    await db.query(
      `UPDATE push_subscriptions SET fcm_token = NULL
       WHERE employee_id = $1 AND fcm_token IS NOT NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead,
  remove,
  removeRead,
  send,
  subscribe,
  unsubscribe,
  subscribeFcm,
  unsubscribeFcm,
};
