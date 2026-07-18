// Service worker do captações (PWA).
// Estratégia conservadora: cacheia SÓ assets estáticos (Next static, ícones,
// fontes, imagens). Navegações, API e dados vão sempre à rede, assim nunca
// servimos HTML autenticado/obsoleto a partir do cache.

const CACHE = "captacoes-static-v4";
const PRECACHE = ["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

const ESTATICO = /\.(?:png|jpg|jpeg|svg|webp|ico|gif|woff2?)$/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const ehAsset =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname) ||
    ESTATICO.test(url.pathname);

  if (!ehAsset) return; // navegações/API/dados: rede direto, sem interceptar.

  // Stale-while-revalidate para assets versionados/estáticos.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const rede = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || rede;
    }),
  );
});
