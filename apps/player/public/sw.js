/* global Headers, ReadableStream, Request, Response, URL, caches, fetch, self */

const SHELL_CACHE = "veyocast-player-shell-v3";
const SHELL_CACHE_PREFIX = "veyocast-player-shell-";
const ASSET_CACHE = "veyocast-player-assets-v1";
const CACHE_PATH_PREFIX = "/__veyocast-player-cache/";
const SHELL_ENTRYPOINTS = [
  "/lg",
  "/manifest.webmanifest",
  "/brand/veyocast-icon-primary.svg",
  "/brand/veyocast-icon-maskable-512.png",
  "/brand/veyocast-logo-inverse.svg"
];
const PREVIOUS_BRAND_NAMESPACE = String.fromCharCode(99, 97, 115, 116, 105, 118, 111);
const PREVIOUS_SHELL_CACHE_PREFIX = `${PREVIOUS_BRAND_NAMESPACE}-player-shell-`;
const PREVIOUS_ASSET_CACHE = `${PREVIOUS_BRAND_NAMESPACE}-player-assets-v1`;
const PREVIOUS_CACHE_PATH_PREFIX = `/__${PREVIOUS_BRAND_NAMESPACE}-player-cache/`;

self.addEventListener("install", (event) => {
  event.waitUntil(precachePlayerShell());
  self.skipWaiting();
});

async function precachePlayerShell() {
  const cache = await caches.open(SHELL_CACHE);
  const shellDocuments = await Promise.all(
    ["/", "/lg"].map(async (pathname) => {
      const request = new Request(pathname, { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Player shell could not be fetched: ${pathname}`);
      await cache.put(new Request(pathname), response.clone());
      return response.text();
    })
  );
  const shellAssets = shellDocuments.flatMap(discoverShellAssets);
  await Promise.all(
    [...new Set([...SHELL_ENTRYPOINTS, ...shellAssets])].map(async (assetUrl) => {
      const request = new Request(assetUrl, { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Player shell asset failed: ${assetUrl}`);
      await cache.put(request, response);
    })
  );
}

function discoverShellAssets(html) {
  const assets = [];
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  for (const match of html.matchAll(attributePattern)) {
    try {
      const url = new URL(match[1], self.location.origin);
      if (
        url.origin === self.location.origin &&
        (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/"))
      ) {
        assets.push(url.toString());
      }
    } catch {
      // Ignore malformed optional document references.
    }
  }
  return assets;
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await migratePreviousAssetCache();
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => (
          (cacheName.startsWith(SHELL_CACHE_PREFIX) && cacheName !== SHELL_CACHE) ||
          cacheName.startsWith(PREVIOUS_SHELL_CACHE_PREFIX)
        ))
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    clients.forEach((client) => client.postMessage({
      cacheVersion: SHELL_CACHE,
      type: "VEYOCAST_SW_ACTIVATED"
    }));
  })());
});

async function migratePreviousAssetCache() {
  const cacheNames = await caches.keys();
  if (!cacheNames.includes(PREVIOUS_ASSET_CACHE)) return;

  const previousCache = await caches.open(PREVIOUS_ASSET_CACHE);
  const currentCache = await caches.open(ASSET_CACHE);
  const requests = await previousCache.keys();

  for (const request of requests) {
    const previousUrl = new URL(request.url);
    if (!previousUrl.pathname.startsWith(PREVIOUS_CACHE_PATH_PREFIX)) continue;
    const response = await previousCache.match(request);
    if (!response) continue;
    previousUrl.pathname = `${CACHE_PATH_PREFIX}${previousUrl.pathname.slice(PREVIOUS_CACHE_PATH_PREFIX.length)}`;
    await currentCache.put(previousUrl.toString(), response);
  }

  await caches.delete(PREVIOUS_ASSET_CACHE);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/device-lab") || url.pathname.startsWith("/api/device-lab")) return;

  if (url.pathname.startsWith(CACHE_PATH_PREFIX)) {
    event.respondWith(serveCachedMedia(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function serveCachedMedia(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cachedResponse = await cache.match(request.url);
  const response = cachedResponse
    ? await ensureRangeHeaders(cache, request.url, cachedResponse)
    : null;
  if (!response) return new Response("Cached asset missing", { status: 404 });

  const rangeHeader = request.headers.get("Range");
  if (!rangeHeader) return withHeader(response, "Accept-Ranges", "bytes");

  const totalBytes = Number(response.headers.get("Content-Length"));
  const parsed = parseRange(rangeHeader, totalBytes);
  if (!parsed) {
    return new Response(null, {
      headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${totalBytes}` },
      status: 416
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(parsed.end - parsed.start + 1));
  headers.set("Content-Range", `bytes ${parsed.start}-${parsed.end}/${totalBytes}`);

  return new Response(sliceStream(response.body, parsed.start, parsed.end), {
    headers,
    status: 206
  });
}

async function ensureRangeHeaders(cache, cacheKey, response) {
  const contentLength = Number(response.headers.get("Content-Length"));
  if (Number.isSafeInteger(contentLength) && contentLength > 0) {
    return response;
  }

  const bytes = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(bytes.byteLength));
  const normalized = new Response(bytes, { headers, status: response.status });
  await cache.put(cacheKey, normalized.clone());
  return normalized;
}

function parseRange(header, totalBytes) {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || !header.startsWith("bytes=")) return null;
  const value = header.slice(6).trim();
  if (!value || value.includes(",")) return null;
  const parts = value.split("-");
  if (parts.length !== 2 || (!parts[0] && !parts[1])) return null;

  if (!parts[0]) {
    const length = Number(parts[1]);
    if (!Number.isSafeInteger(length) || length <= 0) return null;
    return { end: totalBytes - 1, start: Math.max(0, totalBytes - length) };
  }

  const start = Number(parts[0]);
  const end = parts[1] ? Number(parts[1]) : totalBytes - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= totalBytes || end < start) return null;
  return { end: Math.min(end, totalBytes - 1), start };
}

function sliceStream(source, start, end) {
  const reader = source.getReader();
  let offset = 0;
  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const result = await reader.read();
        if (result.done) return controller.close();
        const chunkStart = offset;
        const chunkEnd = offset + result.value.byteLength - 1;
        offset += result.value.byteLength;
        if (chunkEnd < start) continue;
        if (chunkStart > end) {
          await reader.cancel();
          return controller.close();
        }
        const from = Math.max(0, start - chunkStart);
        const to = Math.min(result.value.byteLength, end - chunkStart + 1);
        controller.enqueue(result.value.slice(from, to));
        if (chunkEnd >= end) {
          await reader.cancel();
          controller.close();
        }
        return;
      }
    }
  });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cachedRequest = await cache.match(request);
    if (cachedRequest) return cachedRequest;
    const cachedShell = await cache.match("/");
    if (cachedShell) return cachedShell;
    return new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { headers, status: response.status });
}
