const CACHE_NAME = 'ArK-cache-v1';
const ASSETS = [
    '/',
    'index.html',
    'style.css',
    'app.js',
    'modal.js',
    'argon2-bundled.min.js',
    'manifest.json',
    '192.png',
    '512.png',
    'favicon.ico'
];

// Install and cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// Cache-First / Network-Fallback Strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request);
        })
    );
});
