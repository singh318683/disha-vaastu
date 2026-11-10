// Bump this name on every compass/shell change so activate() drops stale caches.
const CACHE = "disha-shell-v6";
const PRECACHE = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // The browser checks sw.js itself. Intercepting it can pin an old worker.
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined);
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = (await caches.match("/index.html")) || (await caches.match("/"));
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
