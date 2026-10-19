/// <reference lib="webworker" />
// The service worker. Built by vite-plugin-pwa (injectManifest) from
// build-tools/pwa.ts, which decides what lands in self.__WB_MANIFEST: the app
// shell — JS, CSS, icons, the manifest and offline.html. Everything else is
// cached here, as it is used.
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

const DAY = 24 * 60 * 60;
// Precache URLs are relative to the worker, which sits at the base path.
const OFFLINE_PAGE = 'offline.html';
// Runtime caches tied to one version of the app's code.
const PAGES_CACHE = 'pages';
const ROUTE_DATA_CACHE = 'route-data';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// The first install takes over the open page straight away, so its runtime
// caching starts on this visit rather than the next. Updates still wait for
// the visitor: PwaUpdatePrompt asks, and only then sends SKIP_WAITING.
clientsClaim();
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// A cached page names the hashed bundles of the version that rendered it, and
// activating a new version drops those bundles from the precache. Served
// offline after an update, such a page would be markup with no working
// JavaScript — so pages and their data go with the version that made them.
// Only code changes activate a new worker: a data-only rebuild leaves sw.js
// byte-identical, and these caches untouched.
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([caches.delete(PAGES_CACHE), caches.delete(ROUTE_DATA_CACHE)]));
});

// Pages. Network first: event data changes with every rebuild, so a fresh page
// wins whenever there is a connection. Visited pages stay readable offline;
// the 3 s timeout keeps a dead connection from hanging the tab.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: PAGES_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      // A 404.html answer is a real 404 status; never keep it.
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * DAY }),
    ],
  })
);

// React Router's prerendered loader data, fetched on client-side navigation to
// an event or a category hub. Same freshness rules as the pages they belong to.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.data'),
  new NetworkFirst({
    cacheName: ROUTE_DATA_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * DAY }),
    ],
  })
);

// Event lists read from Supabase in the browser. Network first — the list must
// be current — with the last answer kept for when there is no network.
// PostgREST answers paged reads with 206, which the Cache API refuses; only
// full 200s are kept.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: DAY }),
    ],
  })
);

// Google Fonts: the stylesheet may change, the font files never do.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * DAY }),
    ],
  })
);

// Our own images (city photos, category fallback art): content-addressed by
// name and never edited in place.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY }),
    ],
  })
);

// Event art from third-party sites. These arrive opaque (no CORS): the status
// is unreadable, so a failed or blocked image is cached like a good one — stale
// while revalidate serves the copy once and refreshes it behind it, so a
// passing failure does not stick. The browser also counts every opaque entry
// as several MB against the quota whatever its real size — hence the small cap
// and purgeOnQuotaError. Map tiles are left to the browser's own HTTP cache:
// there are thousands, and OpenStreetMap already sends caching headers.
registerRoute(
  ({ request, url, sameOrigin }) =>
    !sameOrigin && request.destination === 'image' && !url.hostname.endsWith('tile.openstreetmap.org'),
  new StaleWhileRevalidate({
    cacheName: 'event-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true }),
    ],
  })
);

// Offline and nothing cached for this page: our own offline page rather than
// the browser's.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return (await matchPrecache(OFFLINE_PAGE)) ?? Response.error();
  }
  return Response.error();
});
