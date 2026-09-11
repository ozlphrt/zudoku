const CACHE_NAME = 'zudoku-cache-v3.0.6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './zudoku-app.html',
  './script.js',
  './sarp-solver.js',
  './favicon.svg',
  './public/192.png',
  './public/512.png',
  './manifest.json'
];

// Install Event - Caching the app shell with cache-busting requests
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache v3.0.0');
        const requests = ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Cleaning up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-first for HTML, Cache-first for others
self.addEventListener('fetch', (event) => {
  const isFontRequest = event.request.url.includes('fonts.googleapis.com') || 
                       event.request.url.includes('fonts.gstatic.com');
  const isLocalRequest = event.request.url.startsWith(self.location.origin);

  if (!isLocalRequest && !isFontRequest) return;

  const isHtml = event.request.mode === 'navigate' || 
                event.request.destination === 'document' ||
                event.request.url.includes('.html');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            // Allow 'opaque' responses for fonts from Google CDNs
            const isOpaque = response.type === 'opaque' || response.type === 'cors';
            const isValid = response && response.status === 200;
            
            if (!isValid && !isOpaque) {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // If fetch fails (offline) and no cache, we just fail gracefully
        });
      })
  );
});
