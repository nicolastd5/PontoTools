// frontend/src/hooks/useFcmWeb.js
import { useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../services/api';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyC6ZcD2wEE5dvQLBpgEG8jLKCBY7H67zmQ',
  authDomain:        'servicestools-57118.firebaseapp.com',
  projectId:         'servicestools-57118',
  storageBucket:     'servicestools-57118.firebasestorage.app',
  messagingSenderId: '88769605854',
  appId:             '1:88769605854:web:9febc845d5ee487cfad24f',
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
