/* SorteBets PWA — cache somente de arquivos públicos e estáticos.
   Dados do placar e chamadas /api/ são SEMPRE network-only. */
const CACHE = "sortebets-shell-android-v1";
const ASSETS = [
  "/", "/sortibet.html", "/css/estilo.css",
  "/js/motor.js", "/js/som.js", "/js/script.js", "/js/pwa.js",
  "/img/icone-dado.png", "/img/logo.webp", "/img/pwa-192.svg",
  "/img/pwa-512.svg", "/manifest.webmanifest",
  "/fonts/dejavu-serif-cond-bi.woff2", "/fonts/lato-400.woff2",
  "/fonts/lato-700.woff2", "/fonts/lato-900.woff2"
];
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("sortebets-shell-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  // Evita misturar versões: serve o shell pré-cacheado apenas sem rede.
  event.respondWith(fetch(req).catch(async () => (await caches.match(req)) || Response.error()));
});
