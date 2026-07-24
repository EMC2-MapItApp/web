// Service Worker dedicado exclusivamente a Web Push (VAPID) — no cachea assets ni ofrece
// funcionamiento offline, así que no usamos @angular/service-worker (pensado para App Shell/
// caché, no para push). Se registra explícitamente desde PushNotificationService con scope '/'.

// TODO(debug-push): log temporal de ciclo de vida — quitar una vez confirmado el flujo end-to-end.
self.addEventListener('install', () => console.log('[push-sw] install'));
self.addEventListener('activate', () => console.log('[push-sw] activate'));

self.addEventListener('push', (event) => {
  console.log('[push-sw] evento push recibido, ¿tiene datos?', !!event.data);
  if (!event.data) return;

  const payload = event.data.json(); // { title, body, url } — ver PushPayload en el backend
  console.log('[push-sw] payload:', payload);
  const options = {
    body: payload.body,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
      .then(() => console.log('[push-sw] showNotification OK'))
      .catch((err) => console.error('[push-sw] showNotification falló', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
