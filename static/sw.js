const CACHE_NAME = 'l8tepicture-v2';
const STATIC_ASSETS = [
    '/gallery',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/manifest.json',
    '/static/img/landing_bg.png'
];

// 1. Install & Cache Static Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
        })
    );
});

// 2. Advanced Fetch Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Cache-First for Thumbnails and Previews (Images don't change often)
    if (url.pathname.startsWith('/thumbnails/') || url.pathname.startsWith('/previews/')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    return response;
                });
            })
        );
        return;
    }

    // Stale-While-Revalidate for JS/CSS
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const fetched = fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
                    return networkResponse;
                });
                return cached || fetched;
            })
        );
        return;
    }

    // Network-only for API calls (Search/Upload)
    event.respondWith(fetch(event.request));
});
