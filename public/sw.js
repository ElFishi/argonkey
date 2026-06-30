const CACHE_NAME = 'ArK-cache-__COMMIT_SHA__';
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
    self.skipWaiting();
});

// Activate: delete any caches that don't match the current version
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('ArK-cache-') && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
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
