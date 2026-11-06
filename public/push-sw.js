// Push reminders. Spec: docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md
//
// Every device gets the same Declarative Web Push payload. This worker rewrites
// it from one IndexedDB record the page keeps: the locale, and the one filter
// the visitor marked with a bell. It fetches nothing and caches nothing.
// Every path ends in exactly one showNotification: Chrome shows its own "site
// updated in the background" otherwise, and Safari revokes the subscription
// after a few silent pushes.
//
// The three IndexedDB names must match src/lib/pushSettingsStore.ts.
// src/lib/pushSw.spec.ts runs this file with a fake `self`, so use `self.`
// for every worker global.

const DB = 'idznamiasto-push';
const STORE = 'kv';
const KEY = 'settings';
const NAME_MAX = 60;
// WebKit can stall IndexedDB in a worker. The reminder must still show.
const READ_TIMEOUT_MS = 3000;

const TEXT = {
  pl: {
    title: 'Idź na miasto',
    body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
    filterBody: 'Zobacz, co nowego pasuje do tego filtra',
  },
  en: {
    title: 'Idź na miasto',
    body: 'See what is new near you',
    filterBody: 'See what is new for this filter',
  },
};

function base() {
  return self.registration.scope.replace(/\/+$/, '');
}

function readSettings() {
  return new Promise((resolve) => {
    let req;
    try {
      req = self.indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const get = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        get.onsuccess = () => {
          db.close();
          resolve(get.result ?? null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

function compose(payload, settings) {
  const home = `${base()}/?src=push`;
  const sent = (payload && payload.notification) || {};
  if (!settings) {
    return { title: sent.title || TEXT.pl.title, body: sent.body || TEXT.pl.body, url: sent.navigate || home };
  }
  const text = TEXT[settings.locale] || TEXT.pl;
  if (settings.preset && settings.preset.id) {
    return {
      title: String(settings.preset.name || '').slice(0, NAME_MAX) || text.title,
      body: text.filterBody,
      url: `${base()}/moje-filtry/?open=${encodeURIComponent(settings.preset.id)}&src=push`,
    };
  }
  return { title: text.title, body: text.body, url: home };
}

async function onPush(event) {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  let timer;
  const settings = await Promise.race([
    readSettings().catch(() => null),
    new Promise((resolve) => {
      timer = self.setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    }),
  ]);
  self.clearTimeout(timer);
  const n = compose(payload, settings);
  await self.registration.showNotification(n.title, {
    body: n.body,
    icon: `${base()}/favicons/web-app-manifest-192x192.png`,
    tag: 'reminder',
    data: { url: n.url },
  });
}

async function openUrl(url) {
  const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const tab of tabs) {
    if (!tab.url.startsWith(self.registration.scope)) continue;
    try {
      await tab.focus();
      await tab.navigate(url);
      return;
    } catch {
      // An uncontrolled tab cannot be navigated from here: open a new one.
      break;
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Caches left by the retired Vite PWA worker (see public/sw.js) for THIS
      // site only: Workbox names them workbox-<kind>-<version>-<scope>, and the
      // dev origin is shared with other GitHub Pages projects. This worker
      // makes no caches of its own.
      const names = await self.caches.keys();
      const mine = names.filter((n) => n.startsWith('workbox-') && n.includes(self.registration.scope));
      await Promise.all(mine.map((name) => self.caches.delete(name)));
      // Control open tabs so a notification click can navigate them.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(onPush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(openUrl(url));
});
