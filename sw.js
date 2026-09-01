const CACHE_NAME = 'garasi-keuangan-v300';
// NETWORK FIRST STRATEGY untuk file utama agar selalu mendapat update terbaru jika online
const ASSETS = ['./', './index.html', './style.css?v=200', './app.js?v=300', './manifest.json', './logo.png', './icon-192.png', './icon-512.png'];

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
    // Abaikan API Firebase/Google
    if (e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com')) return;
    
    // Untuk file HTML, CSS, JS gunakan NETWORK FIRST, jatuh ke Cache jika Offline
    if (e.request.mode === 'navigate' || e.request.url.includes('.js') || e.request.url.includes('.css')) {
        e.respondWith(
            fetch(e.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return response;
            }).catch(() => caches.match(e.request).then(res => res || caches.match('./index.html')))
        );
        return;
    }

    // Untuk file lain (Gambar/Font) gunakan Cache First
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});