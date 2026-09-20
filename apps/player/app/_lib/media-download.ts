/* eslint-disable no-var -- Function body is serialized into the ES5 Static LG bootstrap. */
import { playerMediaTraffic, type createMediaTraffic } from "./media-traffic";

type Download = { bytes: ArrayBuffer; mimeType: string };
/** Session-local single-flight, called only with authenticated manifest/goal
 * assets. Supabase signatures may rotate within the same tenant/object/hash;
 * every other representation parameter and origin remains part of identity.
 * No shared HTTP cache or global request interceptor. The ES5 body is also
 * embedded in Static LG; do not introduce syntax its bootstrap cannot parse. */
export function createMediaDownloader(fetchMedia: (url: string, options: RequestInit, maximumBytes?: number) => Promise<Response>, meter: ReturnType<typeof createMediaTraffic>) {
  var pending = new Map<string, { promise: Promise<Download>; controller: AbortController; users: number }>();
  return function download(url: string, checksum: string, maximumBytes: number, signal?: AbortSignal): Promise<Download> {
    if (signal && signal.aborted) return Promise.reject(new Error("TARGET_SUPERSEDED"));
    var key = checksum + "\n" + url;
    try {
      var identity = new URL(url);
      if (identity.protocol === "https:" && /^\/storage\/v1\/object\/sign\/tenant-media\/tenants\/[a-f0-9-]{36}\/assets\/[a-f0-9-]{36}\//i.test(identity.pathname)) {
        identity.searchParams.delete("token");
        key = checksum + "\n" + identity.href;
      }
    } catch { /* Relative/non-Storage fixtures retain their complete URL. */ }
    var entry = pending.get(key);
    if (entry && entry.controller.signal.aborted) { pending.delete(key); entry = undefined; }
    if (!entry) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 120000);
      var promise = fetchMedia(url, { cache: "no-store", signal: controller.signal }, maximumBytes).then(function (response) {
        if (response.status === 429 || response.status === 503) {
          var retryAfter = response.headers.get("Retry-After");
          if (retryAfter) meter.defer("/__veyocast-player-cache/" + checksum,
            /^[0-9]+$/.test(retryAfter) ? Date.now() + Number(retryAfter) * 1000 : Date.parse(retryAfter));
        }
        if (response.status !== 200 || !response.body || Number(response.headers.get("Content-Length")) > maximumBytes) {
          if (response.body) void response.body.cancel().catch(function () {});
          throw new Error(response.status !== 200 ? "ASSET_FETCH_FAILED_" + response.status : "ASSET_TOO_LARGE_OR_EMPTY");
        }
        var reader = response.body.getReader();
        var chunks: Uint8Array[] = [];
        var length = 0;
        function read(): Promise<Download> {
          return reader.read().then(function (part): Download | Promise<Download> {
            if (part.done) {
              var bytes = new Uint8Array(length);
              var offset = 0;
              chunks.forEach(function (chunk) { bytes.set(chunk, offset); offset += chunk.byteLength; });
              meter.add("downloads", 1);
              meter.downloaded(checksum);
              return { bytes: bytes.buffer, mimeType: response.headers.get("Content-Type") || "application/octet-stream" };
            }
            length += part.value.byteLength;
            meter.add("networkPayloadBytes", part.value.byteLength);
            if (length > maximumBytes) throw new Error("ASSET_TOO_LARGE");
            chunks.push(part.value);
            return read();
          });
        }
        return read().finally(function () { return reader.cancel().catch(function () {}); });
      }).finally(function () { clearTimeout(timeout); var active = pending.get(key); if (active && active.promise === promise) pending.delete(key); });
      entry = { promise: promise, controller: controller, users: 0 };
      pending.set(key, entry);
    }
    var current = entry;
    current.users += 1;
    var abort: (() => void) | undefined;
    var canceled = new Promise<never>(function (_, reject) {
      abort = function () { reject(new Error("TARGET_SUPERSEDED")); };
      if (signal) {
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }
    });
    return Promise.race([current.promise, canceled]).then(function (result) {
      if (result.bytes.byteLength > maximumBytes) throw new Error("ASSET_TOO_LARGE");
      return result;
    }).finally(function () {
      if (abort && signal) signal.removeEventListener("abort", abort);
      current.users -= 1;
      if (!current.users) current.controller.abort();
    });
  };
}

export const downloadMedia = createMediaDownloader((url, options) => fetch(url, options), playerMediaTraffic);
