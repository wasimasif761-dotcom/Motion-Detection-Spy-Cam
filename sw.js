// Motion Detection Spy Cam Service Worker
const CACHE_NAME = 'spycam-v1.0.0';

// Relative assets for GitHub Pages and offline caching
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon.svg'
];

// Install Event - Pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll with individual catch to ensure offline resilience
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-caching asset failed for ${url}:`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore chrome-extension or external analytics
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Fetch fresh version in background if possible
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((fetchErr) => {
        // Network offline, cached response will be returned if available
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating to an HTML page, return root cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
        throw fetchErr;
      });

      // Return cached version right away if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
