const CACHE_NAME = 'garasi-keuangan-v700';
const ASSETS = ['./', './index.html', './style.css?v=700', './app.js?v=700', './manifest.json', './logo.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE_NAME).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com')) return;
    if (e.request.mode === 'navigate' || e.request.url.includes('.js') || e.request.url.includes('.css')) {
        e.respondWith(fetch(e.request).then(response => {
            const clone = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)); return response;
        }).catch(() => caches.match(e.request).then(res => res || caches.match('./index.html')))); return;
    }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});