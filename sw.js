// Must be served from the site's root so its scope covers the whole app.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); }
  catch(e) { data = { title: 'Prep Journal', body: event.data ? event.data.text() : 'Reminder' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Prep Journal', {
      body: data.body || 'Time to prep.',
      tag: 'prep-journal-reminder',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) { if ('focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});