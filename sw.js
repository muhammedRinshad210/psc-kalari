/* Service Worker for PSC Kalari.
   App shell precaching, atomic updates, network-first for HTML, JS, CSS, and data,
   and cache-first for fonts and icons. */

const CACHE_NAME = 'psc-kalari-2a15908842f6';

const PRECACHE_URLS = [
  './',
  './index.html',
  './404.html',
  './about.html',
  './kerala-psc-syllabus.html',
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
  './js/report.js',
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

function fetchWithTimeout(request, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      timer = null;
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request).then(
      (res) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
          resolve(res);
        }
      },
      (err) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
          reject(err);
        }
      }
    );
  });
}

async function networkFirst(request, fallbackUrl = null) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithTimeout(request, 4000);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = (await cache.match(fallbackUrl)) || (await cache.match('./'));
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // 1. Fonts and icons: cache-first
  const isFontOrIcon =
    pathname.includes('/assets/fonts/') ||
    pathname.includes('/assets/icons/') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png');

  if (isFontOrIcon) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 2. Navigations: network-first with cached index.html fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  // 3. HTML, js/*.js, css/*.css, and data/*.json: network-first with 4-second timeout, falling back to CACHE_NAME
  const isNetworkFirst =
    pathname.endsWith('.html') ||
    pathname.endsWith('.js') ||
    pathname.includes('/js/') ||
    pathname.endsWith('.css') ||
    pathname.includes('/css/') ||
    pathname.endsWith('.json') ||
    pathname.includes('/data/') ||
    pathname.endsWith('.webmanifest');

  if (isNetworkFirst) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 4. Fallback: try current cache, then network
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
