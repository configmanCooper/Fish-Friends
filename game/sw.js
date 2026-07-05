// sw.js — precache everything for offline / PWA.
const CACHE = 'fishfriends-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './css/style.css?v=9',
  './js/main.js?v=9',
  './js/config.js', './js/rng.js', './js/levels.js', './js/sim.js',
  './js/render3d.js', './js/fish_models.js', './js/fx.js',
  './js/input.js', './js/ui.js', './js/shop.js', './js/save.js',
  './js/audio.js', './js/debug.js', './js/vendor/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
    const copy = resp.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return resp;
  }).catch(() => caches.match('./index.html'))));
});
