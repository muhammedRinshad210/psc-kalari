/* Service Worker for PSC Kalari.
   App shell precaching, stale-while-revalidate for data, network-first for navigations. */

const CACHE_NAME = 'psc-kalari-2026-11-08T02-41-45-867Z';

const PRECACHE_URLS = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/screens.css',
  './css/fonts.css',
  './assets/favicon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/og-image.png',
  './assets/fonts/bricolage-grotesque/bricolage-grotesque-latin.woff2',
  './assets/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext.woff2',
  './assets/fonts/bricolage-grotesque/bricolage-grotesque-vietnamese.woff2',
  './assets/fonts/hanken-grotesk/hanken-grotesk-latin.woff2',
  './assets/fonts/hanken-grotesk/hanken-grotesk-latin-ext.woff2',
  './assets/fonts/hanken-grotesk/hanken-grotesk-vietnamese.woff2',
  './assets/fonts/hanken-grotesk/hanken-grotesk-cyrillic-ext.woff2',
  './assets/fonts/noto-sans-malayalam/noto-sans-malayalam-malayalam.woff2',
  './assets/fonts/noto-sans-malayalam/noto-sans-malayalam-latin-ext.woff2',
  './assets/fonts/noto-sans-malayalam/noto-sans-malayalam-latin.woff2',
  './js/app.js',
  './js/config.js',
  './js/data.js',
  './js/home.js',
  './js/i18n.js',
  './js/mock.js',
  './js/papers.js',
  './js/progress.js',
  './js/pwa.js',
  './js/quiz.js',
  './js/review.js',
  './js/router.js',
  './js/search.js',
  './js/share.js',
  './js/state.js',
  './js/storage.js',
  './js/syllabus.js',
  './js/theme.js',
  './js/ui.js',
  './js/util.js',
  './data/papers.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // 1. Navigations: Network first with cached fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return (await caches.match('./index.html')) || (await caches.match('./'));
        })
    );
    return;
  }

  // 2. data/q/*.json, data/index.json, and data/*.json: Stale-while-revalidate
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. App shell assets: Cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
