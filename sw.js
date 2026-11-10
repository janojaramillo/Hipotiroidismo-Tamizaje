/* Tiroides Neo · service worker
   Solo dos archivos: index.html (con íconos y manifiesto incrustados) y sw.js.
   Red primero (con 3 s de espera) para la página; caché primero para las fuentes.
   Para publicar una versión nueva, cambie VERSION. */
const VERSION = 'tiroides-neo-v1.1-2026-11-09';
const CORE = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Página: red primero, y si tarda más de 3 s o no hay red, la copia guardada
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const fresh = await Promise.race([fetch(req), timeout(3000)]);
        if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('<h1>Sin conexión</h1><p>Abra la app una vez con internet para guardarla.</p>',
                 { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Fuentes de Google: caché primero, guardadas al primer uso
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

  // Archivos propios: caché primero y actualización en segundo plano
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
  }
});
