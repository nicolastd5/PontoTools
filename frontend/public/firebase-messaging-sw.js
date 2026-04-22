// frontend/public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyC6ZcD2wEE5dvQLBpgEG8jLKCBY7H67zmQ',
  authDomain:        'servicestools-57118.firebaseapp.com',
  projectId:         'servicestools-57118',
  storageBucket:     'servicestools-57118.firebasestorage.app',
  messagingSenderId: '88769605854',
  appId:             '1:88769605854:web:9febc845d5ee487cfad24f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Gerenciador de Serviços';
  const body  = payload.notification?.body  || '';

  self.registration.showNotification(title, {
    body,
    icon:    '/icons/icon-192.svg',
    badge:   '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
  });
});
