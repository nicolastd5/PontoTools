const webpush = require('web-push');
const db      = require('../config/database');
const logger  = require('../utils/logger');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@pontotools.shop',
  process.env.VAPID_PUBLIC_KEY  || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

async function notify(employeeId, title, body, type = 'manual') {
  // 1. Persiste no banco
  const result = await db.query(
    `INSERT INTO notifications (employee_id, title, body, type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [employeeId, title, body, type]
  );
  const notifId = result.rows[0].id;

  // 2. Busca subscriptions Web Push do funcionário
  const subs = await db.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions WHERE employee_id = $1 AND endpoint IS NOT NULL`,
    [employeeId]
  );

  if (subs.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, type });
  let sent = 0;

  // 3. Web Push (browsers)
  const webResults = await Promise.allSettled(
    subs.rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err) => {
        if (err.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
        throw err;
      })
    )
  );
  sent += webResults.filter((r) => r.status === 'fulfilled').length;

  if (sent > 0) {
    await db.query('UPDATE notifications SET push_sent = TRUE WHERE id = $1', [notifId]);
  }

  logger.info('Notificação enviada', { employeeId, type, sent, total: subs.rows.length });
}

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

async function checkTemplates() {
  try {
    const result = await db.query(
      `SELECT * FROM service_templates
       WHERE active = TRUE AND next_run_at <= NOW()`
    );

    for (const tpl of result.rows) {
      // Cria a ordem de serviço
      const inserted = await db.query(
        `INSERT INTO service_orders
           (title, description, assigned_employee_id, unit_id, created_by_id,
            scheduled_date, due_time, template_id)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
         RETURNING id`,
        [
          tpl.title,
          tpl.description,
          tpl.assigned_employee_id,  // pode ser NULL
          tpl.unit_id,
          tpl.created_by_id,
          tpl.next_run_at,           // cast para date no SQL
          tpl.due_time,
          tpl.id,
        ]
      );

      // Notifica funcionário se houver um atribuído
      if (tpl.assigned_employee_id) {
        await notify(
          tpl.assigned_employee_id,
          'Novo serviço atribuído',
          `Você tem um novo serviço: "${tpl.title}".`,
          'service_assigned'
        );
      }

      // Avança next_run_at
      await db.query(
        `UPDATE service_templates
         SET next_run_at = next_run_at + ($1 || ' days')::interval,
             updated_at  = NOW()
         WHERE id = $2`,
        [tpl.interval_days, tpl.id]
      );

      logger.info('Serviço criado pelo template', {
        templateId: tpl.id,
        serviceId:  inserted.rows[0].id,
      });
    }
  } catch (err) {
    logger.error('Erro no cron de templates', { error: err.message });
  }
}

function startCron() {
  setInterval(async () => {
    await checkLateServices();
    await checkTemplates();
  }, 60 * 60 * 1000);
  checkLateServices();
  checkTemplates();
}

module.exports = { notify, startCron };
