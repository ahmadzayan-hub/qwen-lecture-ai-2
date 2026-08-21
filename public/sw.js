const CACHE = "qla-v32"
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest"]))
  )
  self.skipWaiting()
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return
  const url = new URL(e.request.url)
  // Never cache the transformers model CDN or dev-server module requests
  if (url.origin !== self.location.origin) return
  e.respondWith(
    caches.match(e.request).then(
      (h) =>
        h ||
        fetch(e.request)
          .then((r) => {
            if (r.ok) {
              const c = r.clone()
              caches.open(CACHE).then((x) => x.put(e.request, c))
            }
            return r
          })
          .catch(() => caches.match("./index.html"))
    )
  )
})
