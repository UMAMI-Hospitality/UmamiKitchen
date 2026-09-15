/* Umami kitchen log — offline support.
   Network first, so a redeploy is picked up straight away; falls back to
   cache when there is no signal, which is the point in a basement kitchen. */
const V = 'umami-kitchen-v3';
const SHELL = ['./', './index.html', './manifest.json',
               './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;                          // saves go straight to the network
  if (new URL(r.url).origin !== location.origin) return;   // never touch Apps Script
  e.respondWith(
    fetch(r)
      .then(res => { const copy = res.clone();
                     caches.open(V).then(c => c.put(r, copy)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('./index.html')))
  );
});
