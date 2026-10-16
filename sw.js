const CACHE = 'cove-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=> k!==CACHE).map(k=> caches.delete(k)))) .then(()=> self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // For share_target and public links, go network first
  if (url.searchParams.has('url') || url.searchParams.has('text') || url.hash.startsWith('#p=')) {
    e.respondWith(fetch(e.request).catch(()=> caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res=>{
      // cache html/js for offline
      if (e.request.method==='GET' && res.ok) {
        const copy=res.clone();
        caches.open(CACHE).then(c=> c.put(e.request, copy));
      }
      return res;
    }).catch(()=> caches.match('./index.html')))
  );
});
