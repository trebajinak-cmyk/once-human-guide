/* Once Human Guide v19 — cache thin host + modules + pack */
const CACHE = 'ohg-2026-10-09-v19.2-372';
const PRECACHE = [
  './once_human_guide_v19.html',
  './once_human_guide_v18.html',
  './ohg_data.js',
  './ohg_sw.js',
  './version.json',
  './modules/ohg_runtime.js',
  './modules/ohg_map.js',
  './modules/ohg_builds.js',
  './modules/ohg_pack_channel.js',
  './modules/ohg_links.js',
  './modules/ohg_quality.js',
  './modules/ohg_selfheal.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && req.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./once_human_guide_v19.html')))
  );
});
