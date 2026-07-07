// sw.js — NETWORK-FIRST service worker.
// Online: always fetch the freshest bytes from the network (so every open acts
// like a hard refresh and picks up the latest deploy) and update the cache.
// Offline: fall back to the cached copy so you can still play what you played.
const CACHE = 'fishfriends-v40';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './css/style.css?v=40',
  './js/main.js?v=40',
  './assets/FishFriendsSong.mp3?v=1',
  './js/config.js', './js/rng.js', './js/levels.js', './js/sim.js',
  './js/render3d.js', './js/fish_models.js', './js/fx.js',
  './js/input.js', './js/ui.js', './js/shop.js', './js/save.js',
  './js/audio.js', './js/debug.js', './js/vendor/three.module.js',
];

self.addEventListener('install', (e) => {
  // Precache so a first offline visit works; don't fail install if some 404.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through
  // Large, effectively-immutable media (audio) is served cache-first so we don't
  // re-download it on every open; a new track would use a new filename/version.
  if (/\.(mp3|ogg|wav)(\?|$)/i.test(url.pathname + url.search)) {
    e.respondWith(cacheFirst(req));
    return;
  }
  e.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
  return fresh;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // `cache: 'no-store'` bypasses the browser HTTP cache -> a true fresh pull.
    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    // Offline (or network error): serve the cached copy so play continues.
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const idx = await cache.match('./index.html');
      if (idx) return idx;
    }
    throw err;
  }
}
