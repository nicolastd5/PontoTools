// frontend/public/firebase-messaging-sw.js
// Build placeholders (__VITE_FIREBASE_*) are replaced in vite.config.js during `vite build`.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: '__VITE_FIREBASE_API_KEY__',
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket: '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => value && !value.startsWith('__VITE_')
);

if (hasFirebaseConfig) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Quando o payload já vem com `notification`, o navegador pode exibir automaticamente.
    // Evita duplicidade ao não chamar showNotification duas vezes.
    if (payload?.notification?.title || payload?.notification?.body) {
      return;
    }

    const title = payload.data?.title || 'Gerenciador de Serviços';
    const body = payload.data?.body || '';

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200],
    });
  });
} else {
  console.warn('[FCM SW] Firebase config ausente. Verifique as variáveis VITE_FIREBASE_* no build.');
}
