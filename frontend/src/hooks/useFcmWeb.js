// frontend/src/hooks/useFcmWeb.js
import { useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../services/api';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function getFirebaseMessaging() {
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return getMessaging(app);
}

async function registerFcmToken() {
  try {
    const messaging = getFirebaseMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    await api.post('/notifications/fcm-token', { token });
  } catch (err) {
    console.warn('[FCM] Falha ao registrar token:', err.message);
  }
}

export function useFcmWeb(isLoggedIn) {
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!VAPID_KEY) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    registerFcmToken();

    try {
      const messaging = getFirebaseMessaging();
      unsubRef.current = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'Gerenciador de Serviços';
        const body  = payload.notification?.body  || '';
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icons/icon-192.svg',
          });
        }
      });
    } catch {}

    return () => {
      unsubRef.current?.();
    };
  }, [isLoggedIn]);
}
