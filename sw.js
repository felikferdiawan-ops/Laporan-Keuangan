const CACHE_NAME = 'garasi-keuangan-v101';
const ASSETS = ['./', './index.html', './style.css?v=101', './app.js?v=101', './manifest.json', './logo.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => { 
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); 
});

self.addEventListener('activate', (e) => { 
    e.waitUntil(
        caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE_NAME).map(x => caches.delete(x))))
        .then(() => self.clients.claim())
    ); 
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com')) return;
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});