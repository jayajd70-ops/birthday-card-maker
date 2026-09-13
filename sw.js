/* Birthday Card Maker Premium — service worker */
const VERSION = 'bcm-v1.2.0';
const CORE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/engine.js',
  './js/storage.js',
  './js/themes.js',
  './js/ai.js',
  './js/data/decorations.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/decorations/white-peony-top-down.webp',
  './assets/decorations/velvet-ribbon-pink.webp',
  './assets/decorations/silver-satin-ribbon-premium.webp',
  './assets/decorations/silver-metallic-dust.png',
  './assets/decorations/silver-leaf-sprig-premium.webp',
  './assets/decorations/silk-satin-bow-ivory.webp',
  './assets/decorations/sage-green-candle-premium.webp',
  './assets/decorations/romantic-taper-candle-premium.webp',
  './assets/decorations/pink-rose-bouquet.webp',
  './assets/decorations/gold-foil-bits.png',
  './assets/decorations/gift-box-gold.webp',
  './assets/decorations/gift-box-blue.webp',
  './assets/decorations/eucalyptus-branch.webp',
  './assets/decorations/celebration-cake-studio.webp',
  './assets/decorations/blue-metallic-balloon-premium.webp',
  './assets/decorations/balloon-gold-premium.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin requests to keep it simple and safe
  if (url.origin !== self.location.origin) return;
  // Skip IndexedDB — browser handles this natively; sw doesn't intercept.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    if (cached) {
      // Revalidate in background
      fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => null);
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && (req.destination === 'image' || req.destination === 'script' || req.destination === 'style' || req.destination === 'document' || req.destination === 'font')) {
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      // Fallback: return cached index for navigation requests
      if (req.mode === 'navigate') return cache.match('./index.html');
      throw new Error('offline');
    }
  })());
});
