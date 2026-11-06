// Shows whatever arrives, so the spike tests only delivery and encryption.
self.addEventListener('push', (event) => {
  let n = { title: 'push spike', body: '(no payload)' };
  try {
    n = event.data.json().notification;
  } catch {}
  event.waitUntil(self.registration.showNotification(n.title, { body: n.body }));
});
