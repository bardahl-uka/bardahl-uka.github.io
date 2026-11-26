const CACHE_NAME = 'bardahl-combined-v30-price-in-index';
const CACHE_PREFIX = 'bardahl-combined-';
const CORE = ['./', './index.html', './styles.css', './js/app.js', './js/clock.js', './js/backgrounds.js', './js/opacity-slider.js', './js/rounds-clip.js', './js/report-date-sync.js', './js/no-zoom.js', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];
const ASSETS_URL = new URL('./assets/', self.registration.scope).href;
const CORE_URLS = new Set(CORE.map(path => new URL(path, self.registration.scope).href));
// Supabase client library from CDN: cache it so the app shell can start offline.
const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.url.startsWith(SUPABASE_LIB)) {
    // network first, fall back to the cached copy when offline
    event.respondWith(fetch(request).then(async response => {
      if (response && (response.ok || response.type === 'opaque')) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); }
      return response;
    }).catch(async () => {
      const cached = await (await caches.open(CACHE_NAME)).match(request);
      return cached || Response.error();
    }));
    return;
  }
  if (request.url.startsWith(ASSETS_URL)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }));
    return;
  }
  if (!CORE_URLS.has(request.url)) return;
  const network = fetch(request);
  event.waitUntil(network.then(async response => {
    if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); }
  }).catch(() => {}));
  event.respondWith(network.catch(async () => {
    const cache = await caches.open(CACHE_NAME), cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') { const page = await cache.match(new URL('./index.html', self.registration.scope).href); if (page) return page; }
    return Response.error();
  }));
});
