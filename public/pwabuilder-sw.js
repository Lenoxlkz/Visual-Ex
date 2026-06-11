/*
 * Service worker logic based on MDN js13kGames PWA tutorial
 * https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Offline_Service_workers
 */

const cacheName = 'visual-x-pwa-v5';
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
     // Network-first strategy for JS and HTML files to prevent chunk/module loading errors in dev
     const isJsOrHtml = e.request.url.endsWith('.js') || e.request.url.endsWith('.html') || e.request.url.includes('/chunk-');
     
     if (isJsOrHtml) {
       try {
         const networkResponse = await fetch(e.request);
         if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const cache = await caches.open(cacheName);
            cache.put(e.request, networkResponse.clone());
         }
         return networkResponse;
       } catch (error) {
         console.log('[Service Worker] Network failed, falling back to cache: ' + e.request.url);
         const cachedResponse = await caches.match(e.request);
         if (cachedResponse) return cachedResponse;
         if (e.request.mode === 'navigate') {
           const cache = await caches.open(cacheName);
           return await cache.match('/index.html');
         }
         throw error;
       }
     }

     // Cache-first (Stale-While-Revalidate pattern) for other resources
     const cachedResponse = await caches.match(e.request);
     
     const fetchPromise = fetch(e.request).then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
           const cache = await caches.open(cacheName);
           console.log('[Service Worker] Caching new resource: ' + e.request.url);
           cache.put(e.request, networkResponse.clone());
        }
        return networkResponse;
     }).catch(async (error) => {
        console.log('[Service Worker] Fetch failed, network offline: ' + e.request.url);
        if (e.request.mode === 'navigate') {
          const cache = await caches.open(cacheName);
          return await cache.match('/index.html');
        }
        throw error;
     });

     if (cachedResponse) {
       console.log('[Service Worker] Fetching resource from cache: ' + e.request.url);
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
       // Trigger clients to sync if they are open
       const clientsList = await clients.matchAll();
       if (clientsList.length > 0) {
           clientsList.forEach(client => client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' }));
       } else {
           console.log('[Service Worker] No clients open, unable to perform full file system sync.');
       }
    })());
  }
});

self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic background sync event fired:', event.tag);
  if (event.tag === 'visualx-periodic-sync') {
    event.waitUntil((async () => {
       console.log('[Service Worker] Performing periodic background sync...');
       // Trigger clients to sync
       const clientsList = await clients.matchAll();
       if (clientsList.length > 0) {
           clientsList.forEach(client => client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' }));
       } else {
           console.log('[Service Worker] No clients open, unable to perform full file system sync.');
       }
       const cache = await caches.open(cacheName);
       await cache.add('/index.html');
    })());
  }
});
