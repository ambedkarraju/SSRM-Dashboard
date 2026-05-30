// ═══════════════════════════════════════════════
//  SSRM Revenue Intelligence Platform
//  Service Worker — Cache-first with network fallback
// ═══════════════════════════════════════════════

const CACHE_NAME = 'ssrm-v2';

// Core shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './uploader.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL: pre-cache shell assets ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for shell, network-first for API ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always hit the network for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for everything else (app shell, fonts, CDN libs)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache valid responses (not opaque, not errors)
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
