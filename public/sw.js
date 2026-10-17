const CACHE = "disha-shell-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.add("/");
      await Promise.all(
        ["/manifest.webmanifest", "/icon.svg"].map((url) =>
          cache.add(url).catch(() => {}),
        ),
      );
    }),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("disha-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    /signin|signout|callback/.test(url.pathname)
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status >= 500) throw new Error("Offline server");
          if (
            response.ok &&
            response.type !== "opaqueredirect" &&
            new URL(response.url).pathname === "/"
          ) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match("/")) ||
            new Response("Connect once to prepare offline learning.", {
              status: 503,
            }),
        ),
    );
    return;
  }
  if (/\.(js|css|svg|woff2?)(\?|$)/.test(url.pathname))
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
});
