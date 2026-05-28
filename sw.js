const CACHE_NAME = 'aura-ledger-v14';
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

// Fetch Event - Network-First with Cache-Fallback and Cache-Busting strategy for immediate updates when online
self.addEventListener('fetch', (e) => {
  // Only intercept GET requests
  if (e.request.method !== 'GET') {
    return;
  }

  // Only intercept HTTP/S requests, bypass chrome-extension or external analytics if needed
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.startsWith('http')) {
    return;
  }

  const isLocal = e.request.url.startsWith(self.location.origin);

  if (isLocal) {
    e.respondWith(
      // Force fetching from network and bypassing browser HTTP cache (revalidating with server)
      fetch(e.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if network request fails (e.g. offline)
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            console.warn('[Service Worker] Asset not in cache and network offline:', e.request.url);
          });
        })
    );
  } else {
    // For external requests, standard network-first strategy without forcing cache: 'no-cache'
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
          });
        })
    );
  }
});
