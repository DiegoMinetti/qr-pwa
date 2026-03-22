const CACHE_NAME = 'qr-pwa-v1';
const FILES = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Add files individually to avoid failing the whole install if one file is missing
      await Promise.all(FILES.map(async (f) => {
        try{
          const resp = await fetch(f);
          if(resp && resp.ok){
            await cache.put(f, resp.clone());
          } else {
            // ignore non-ok responses
            console.warn('sw install: could not fetch', f, resp && resp.status);
          }
        }catch(e){
          console.warn('sw install: fetch failed for', f, e);
        }
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  // Clean up old caches and take control immediately
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
  // Notify clients that a new service worker is active
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED' }));
  });
});

// Fetch strategy: network-first for app shell (index/app.js/style), cache fallback for others
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // Handle navigation requests (SPA) and key assets with network-first
  if (evt.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/style.css') || url.pathname.endsWith('/manifest.json')) {
    // Network-first for shell files, but fall back to cache on error
    evt.respondWith(
      fetch(evt.request).then(resp => {
        // update cache, but handle failures silently
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(evt.request, copy)).catch(()=>{});
        return resp;
      }).catch(() => caches.match(evt.request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Default: try cache first, then network; handle network errors gracefully
  evt.respondWith(
    caches.match(evt.request).then(r => {
      if (r) return r;
      return fetch(evt.request).then(resp => {
        // store in cache for future, but ignore failures
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(evt.request, copy)).catch(()=>{});
        return resp;
      }).catch(() => {
        // final fallback: try to serve a cached index.html for navigation or a generic Response
        return caches.match('/index.html');
      });
    })
  );
});

// Allow the page to trigger skipWaiting via postMessage
self.addEventListener('message', evt => {
  if (evt.data && evt.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
