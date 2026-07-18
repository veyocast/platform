/* global Headers, ReadableStream, Request, Response, URL, caches, fetch, self */

const SHELL_CACHE = "castivo-player-shell-v1";
const ASSET_CACHE = "castivo-player-assets-v1";
const CACHE_PATH_PREFIX = "/__castivo-player-cache/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add(new Request("/"))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
  const response = await (await caches.open(ASSET_CACHE)).match(request.url);
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
    return (await cache.match(request)) ?? (await cache.match("/")) ?? new Response("Offline", { status: 503 });
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
