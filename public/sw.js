// Retires the service worker that the short-lived Vite + PWA build (#9, live
// on the dev site 2026-10-19/20) installed in visitors' browsers.
//
// Removing sw.js is not enough: a browser keeps an installed worker when its
// script starts returning 404, and that worker would go on intercepting this
// site's requests. So the same URL now serves this one. The browser picks it up
// on its next update check, and it deletes every cache the old worker made,
// unregisters itself, and reloads the open tabs onto the plain site.
//
// Nothing in the app registers a service worker, so a browser that never had
// the old one never runs this. It can be deleted once old visits have aged out
// (a few weeks is plenty for the dev site).
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) client.navigate(client.url);
    })()
  );
});
