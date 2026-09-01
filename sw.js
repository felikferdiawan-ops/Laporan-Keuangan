const CACHE_NAME='garasi-keuangan-v102';
const ASSETS=['./','./index.html','./style.css?v=102','./app.js?v=102','./manifest.json','./logo.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(/firebaseio|googleapis|gstatic|cdn\.|cdnjs/.test(e.request.url)) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});