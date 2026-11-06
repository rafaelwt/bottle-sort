/* Bottle Sort — service worker.
 * - Precachea el shell, los niveles y los sprites (la app no arranca sin ellos).
 * - Los sonidos se cachean a demanda (3,8 MB que en su mayoría no se usan).
 * - Navegación: network-first (para que las versiones nuevas lleguen) con
 *   respaldo en caché cuando no hay red.
 * - Estáticos: stale-while-revalidate.
 * Subir CACHE_VERSION en cada release para invalidar.
 */
const CACHE_VERSION = "bottle-sort-v2";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "engine.js",
  "manifest.webmanifest",
  "data/levels.js",
  "data/catalog.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "sprites/bottle_front.png",
  "sprites/cork.png",
  "sprites/drop.png",
  "sprites/drop0.png",
  "sprites/glow.png",
  "sprites/mask.png",
  "sprites/splash.png",
  "sprites/splash2.png",
  "sprites/star-white.png",
  "sprites/star.png",
  "sprites/stream.png",
  "sprites/surface--1.png",
  "sprites/surface-0.png",
  "sprites/surface-1.png",
  "sprites/surface-10.png",
  "sprites/surface-11.png",
  "sprites/surface-13.png",
  "sprites/surface-17.png",
  "sprites/surface-18.png",
  "sprites/surface-19.png",
  "sprites/surface-2.png",
  "sprites/surface-20.png",
  "sprites/surface-21.png",
  "sprites/surface-22.png",
  "sprites/surface-3.png",
  "sprites/surface-4.png",
  "sprites/surface-5.png",
  "sprites/surface-6.png",
  "sprites/surface-7.png",
  "sprites/surface-8.png",
  "sprites/surface-9.png",
  "sprites/waterlight.png",
  "sprites/waterline.png",
  "sprites/waterline2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: red primero, caché si no hay conexión.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  // Sonidos: caché primero (no cambian), se piden una sola vez.
  if (url.pathname.includes("/sounds/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Resto (js/css/datos/sprites): sirve de caché y actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then((hit) => {
      const red = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
