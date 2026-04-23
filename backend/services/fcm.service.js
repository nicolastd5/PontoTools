// backend/services/fcm.service.js
const path   = require('path');
const db     = require('../config/database');
const logger = require('../utils/logger');

let messaging = null;

function getMessaging() {
  if (messaging) return messaging;

  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      || path.join(__dirname, '..', 'firebase-service-account.json');

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  messaging = admin.messaging();
  return messaging;
}

async function sendFcm(employeeId, title, body) {
  try {
    const result = await db.query(
      `SELECT id, fcm_token FROM push_subscriptions
       WHERE employee_id = $1 AND fcm_token IS NOT NULL`,
      [employeeId]
    );

    if (result.rows.length === 0) return 0;

    const tokens = result.rows.map((r) => r.fcm_token);

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        title: title || '',
        body: body || '',
        url: '/notifications',
      },
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '2419200', // 28 dias
        },
        notification: {
          title,
          body,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
        },
        fcmOptions: {
          link: 'https://pontotools.shop/notifications',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    // Remover tokens inválidos
    const invalidIds = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidIds.push(result.rows[idx].id);
        }
      }
    });

    if (invalidIds.length > 0) {
      await db.query(
        `DELETE FROM push_subscriptions WHERE id = ANY($1::int[])`,
        [invalidIds]
      );
    }

    const sent = response.successCount;
    logger.info('FCM enviado', { employeeId, sent, total: tokens.length });
    return sent;
  } catch (err) {
    logger.error('Erro ao enviar FCM', { employeeId, error: err.message });
    return 0;
  }
}

module.exports = { sendFcm };
