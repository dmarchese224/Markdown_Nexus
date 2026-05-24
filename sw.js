const CACHE_NAME = 'noteshelf-cache-v1';
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Check if it is a CDN or a local asset
  const isCDN = url.hostname.includes('tailwindcss.com') ||
                url.hostname.includes('unpkg.com') ||
                url.hostname.includes('jsdelivr.net') ||
                url.hostname.includes('googleapis.com') ||
                url.hostname.includes('gstatic.com');

  const isLocalAsset = ASSETS.some(asset => url.pathname.endsWith(asset));

  if (isCDN || isLocalAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Stale-while-revalidate for network assets
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch((err) => {
          // Silently absorb fetch errors when offline
          console.log('Background fetch failed offline for:', event.request.url);
        });

        return cachedResponse || fetchPromise;
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});