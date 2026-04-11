// Serviço de Web Push — envia notificações via browser PushManager
const webpush = require('web-push');
const db      = require('../config/database');
const logger  = require('../utils/logger');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@pontotools.shop',
  process.env.VAPID_PUBLIC_KEY  || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

/**
 * Salva notificação no banco e tenta enviar push para o funcionário.
 * @param {number} employeeId
 * @param {string} title
 * @param {string} body
 * @param {string} type  manual | service_assigned | service_late | service_problem
 */
async function notify(employeeId, title, body, type = 'manual') {
  // 1. Persiste no banco
  const result = await db.query(
    `INSERT INTO notifications (employee_id, title, body, type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [employeeId, title, body, type]
  );
  const notifId = result.rows[0].id;

  // 2. Busca subscriptions do funcionário
  const subs = await db.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE employee_id = $1`,
    [employeeId]
  );

  if (subs.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, type });

  // 3. Envia push para cada subscription (em paralelo)
  const results = await Promise.allSettled(
    subs.rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err) => {
        // 410 Gone = subscription expirada, remove do banco
        if (err.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
        throw err;
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  if (sent > 0) {
    await db.query('UPDATE notifications SET push_sent = TRUE WHERE id = $1', [notifId]);
  }

  logger.info('Notificação enviada', { employeeId, type, sent, total: subs.rows.length });
}

/**
 * Cron: verifica serviços atrasados e envia notificação (roda a cada hora).
 */
async function checkLateServices() {
  try {
    const result = await db.query(
      `SELECT so.id, so.title, so.assigned_employee_id
       FROM service_orders so
       WHERE so.status IN ('pending','in_progress')
         AND so.late_notified = FALSE
         AND (
           so.scheduled_date < CURRENT_DATE
           OR (so.scheduled_date = CURRENT_DATE AND so.due_time IS NOT NULL AND so.due_time < CURRENT_TIME)
         )`
    );

    for (const row of result.rows) {
      await notify(
        row.assigned_employee_id,
        'Serviço atrasado',
        `O serviço "${row.title}" está atrasado e ainda não foi concluído.`,
        'service_late'
      );
      await db.query('UPDATE service_orders SET late_notified = TRUE WHERE id = $1', [row.id]);
    }
  } catch (err) {
    logger.error('Erro no cron de serviços atrasados', { error: err.message });
  }
}

// Inicia cron a cada hora
function startCron() {
  setInterval(checkLateServices, 60 * 60 * 1000);
  // Roda uma vez na inicialização também
  checkLateServices();
}

module.exports = { notify, startCron };
