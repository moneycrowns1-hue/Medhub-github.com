const STATIC_CACHE = "somagnus-static-v2";
const RUNTIME_CACHE = "somagnus-runtime-v2";
const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname.replace(/\/$/, "");
const route = (path) => `${scopePath}${path}`;
const PRECACHE_URLS = [route("/"), route("/biblioteca/"), route("/lector/"), route("/manifest.webmanifest")];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(route("/"));
        }),
    );
    return;
  }

  const shouldRuntimeCache =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    url.pathname.endsWith("pdf.worker.min.js") ||
    url.pathname.endsWith("pdf.worker.min.mjs") ||
    url.pathname.includes("/_next/static/");

  if (!shouldRuntimeCache) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
