const webpush = require('web-push');
const admin   = require('firebase-admin');
const db      = require('../config/database');
const logger  = require('../utils/logger');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@pontotools.shop',
  process.env.VAPID_PUBLIC_KEY  || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

// Inicializa firebase-admin apenas uma vez
if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

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
    `SELECT id, endpoint, p256dh, auth, fcm_token
     FROM push_subscriptions WHERE employee_id = $1`,
    [employeeId]
  );

  if (subs.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, type });
  let sent = 0;

  // 3. Web Push (browsers)
  const webSubs = subs.rows.filter((s) => s.endpoint);
  const webResults = await Promise.allSettled(
    webSubs.map((sub) =>
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

  // 4. FCM (Android app nativo)
  const fcmSubs = subs.rows.filter((s) => s.fcm_token);
  if (fcmSubs.length > 0 && admin.apps.length) {
    const fcmResults = await Promise.allSettled(
      fcmSubs.map((sub) =>
        admin.messaging().send({
          token: sub.fcm_token,
          notification: { title, body },
          data: { type },
          android: { priority: 'high' },
        }).catch(async (err) => {
          // Token inválido ou desregistrado — remove
          const code = err?.errorInfo?.code || '';
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            await db.query(
              'UPDATE push_subscriptions SET fcm_token = NULL WHERE id = $1',
              [sub.id]
            );
          }
          throw err;
        })
      )
    );
    sent += fcmResults.filter((r) => r.status === 'fulfilled').length;
  }

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

function startCron() {
  setInterval(checkLateServices, 60 * 60 * 1000);
  checkLateServices();
}

module.exports = { notify, startCron };
