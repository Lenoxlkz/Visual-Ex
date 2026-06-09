/*
 * Service worker logic based on MDN js13kGames PWA tutorial
 * https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Offline_Service_workers
 */

const cacheName = 'visual-x-pwa-v4';
const appShellFiles = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.png'
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    await cache.addAll(appShellFiles);
  })());
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activate');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== cacheName) {
            console.log(`[Service Worker] Removing old cache: ${key}`);
            return caches.delete(key);
          }
        }),
      );
    }),
  );
});

self.addEventListener('fetch', (e) => {
  // Ignore non-http/https requests
  if (!e.request.url.startsWith('http')) return;

  e.respondWith((async () => {
     // Check if we have it in the cache
     const cachedResponse = await caches.match(e.request);
     
     // Fetch from network to update cache (Stale-While-Revalidate-like)
     // Or fetch it completely if not in cache
     const fetchPromise = fetch(e.request).then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
           const cache = await caches.open(cacheName);
           // Custom caching per MDN tutorial
           console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
           cache.put(e.request, networkResponse.clone());
        }
        return networkResponse;
     }).catch(async (error) => {
        console.log(`[Service Worker] Fetch failed, network offline: ${e.request.url}`);
        // Fallback for navigation requests
        if (e.request.mode === 'navigate') {
          const cache = await caches.open(cacheName);
          return await cache.match('/index.html');
        }
        throw error;
     });

     // Return cached response immediately if available, otherwise wait for network fetch
     // This ensures fast loading while allowing updates from network
     if (cachedResponse) {
       console.log(`[Service Worker] Fetching resource from cache: ${e.request.url}`);
       return cachedResponse;
     }

     return await fetchPromise;
  })());
});

self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync event fired:', event.tag);
  if (event.tag === 'visualx-sync') {
    event.waitUntil((async () => {
       console.log('[Service Worker] Performing background sync...');
       // Perform background sync logic here (e.g. sync offline changes with server)
    })());
  }
});

self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic background sync event fired:', event.tag);
  if (event.tag === 'visualx-periodic-sync') {
    event.waitUntil((async () => {
       console.log('[Service Worker] Performing periodic background sync...');
       // Perform periodic task here (e.g. update cached content, check for app updates)
       const cache = await caches.open(cacheName);
       await cache.add('/index.html');
    })());
  }
});
