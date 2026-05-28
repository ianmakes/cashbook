const CACHE_NAME = 'aura-ledger-v7';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './data.js',
  './storage.js',
  './app.js',
  './manifest.json'
];

// Install Event - cache core shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching Shell Assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Clearing Old Cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network fallback to cache with offline resiliency
self.addEventListener('fetch', (e) => {
  // Only intercept HTTP/S requests, bypass chrome-extension or external analytics if needed
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.startsWith('http')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in the background (Stale-While-Revalidate pattern)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, networkResponse);
            });
          }
        }).catch(() => { /* Ignore offline fetch errors */ });
        
        return cachedResponse;
      }
      
      return fetch(e.request).catch(() => {
        // Offline fallback if not cached
        console.log('[Service Worker] Asset not in cache and network offline:', e.request.url);
      });
    })
  );
});
