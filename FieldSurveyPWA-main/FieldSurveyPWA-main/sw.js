/**
 * VKU Field Survey PWA Service Worker
 * Implements App Shell Cache-First, Stale-While-Revalidate for questions.md,
 * and offline fallback support.
 */

const CACHE_NAME = 'vku-field-survey-v1';

// App Shell Core Assets
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './questions.md',
  './vku_facility_inspection_data.csv',
  './sw.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './favicon.ico'
];

// Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install Event - Pre-caching App Shell');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old cache versions
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate Event - Cleaning old caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Apply appropriate Caching Strategy based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Stale-While-Revalidate for questions.md so question updates load quickly
  if (url.pathname.endsWith('questions.md')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 2: Network-Only for Google Sheets API requests / external POSTs
  if (event.request.method === 'POST' || url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Strategy 3: Cache-First for static assets (HTML, CSS, JS, Images, Icons)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Don't cache non-OK responses or non-GET requests
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML page navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Background Sync Listener (if supported by browser)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-surveys') {
    console.log('[ServiceWorker] Background Sync Triggered for survey queue');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach(client => {
          client.postMessage({ type: 'TRIGGER_SYNC' });
        });
      })
    );
  }
});
