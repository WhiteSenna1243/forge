// Offline support: always try the network first (so updates show up), fall back to the last copy.
const CACHE = 'forge-v2';
const SHELL = ['./', 'index.html', 'calc.js', 'coach.js', 'dining.js', 'sync.js', 'config.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$|^cdn\.jsdelivr\.net$/.test(url.hostname); // fonts + the login library, for offline
  if (e.request.method !== 'GET' || (url.origin !== location.origin && !fonts)) return;
  e.respondWith(fetch(e.request)
    .then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
