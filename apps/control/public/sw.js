/* global Request, Response, URL, caches, fetch, self */

const SHELL_CACHE = "veyocast-control-shell-v1";
const SHELL_CACHE_PREFIX = "veyocast-control-shell-";
const PUBLIC_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/brand/veyocast-icon-primary.svg",
  "/brand/veyocast-icon-192.png",
  "/brand/veyocast-icon-512.png",
  "/brand/veyocast-icon-maskable-192.png",
  "/brand/veyocast-icon-maskable-512.png",
  "/brand/veyocast-logo-inverse.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        PUBLIC_SHELL.map(async (path) => {
          const request = new Request(path, { cache: "reload" });
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response);
        })
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VEYOCAST_CONTROL_SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never persist authenticated HTML, API responses or signed media in Cache Storage.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.open(SHELL_CACHE)).match("/offline.html") ??
        new Response("VeyoCast is offline.", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          status: 503
        })
      )
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })
    );
  }
});
