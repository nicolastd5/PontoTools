// Push event handler — injected into service worker via importScripts or additionalManifestEntries
// VitePWA injectManifest mode: this file is used as the custom SW

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Ponto Eletrônico', body: event.data.text() };
  }

  const options = {
    body:    data.body || '',
    icon:    '/icons/icon-192.svg',
    badge:   '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ponto Eletrônico', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
