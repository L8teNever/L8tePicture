/**
 * P.I.X.I. Service Worker
 * Caches UI assets for offline use
 */

const CACHE_NAME = 'pixi-v1';
const ASSETS = [
    '/',
    '/static/index.html',
    '/static/css/material-you.css',
    '/static/css/animations.css',
    '/static/js/theme.js',
    '/static/js/gallery.js',
    '/static/js/slideshow.js',
    '/static/js/gestures.js',
    '/static/js/app.js',
    'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only cache static assets and the root
    if (event.request.url.includes('/api/') || event.request.url.includes('/cache/') || event.request.url.includes('/pictures/')) {
        return; // Let the network handle dynamic content
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
