import { lookup } from "node:dns/promises";
import { request as httpRequest, type ClientRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";

import { createPinnedLookup, isPublicIp } from "./safe-rss-fetch";

export const rssImageMaximumBytes = 8_000_000;
export const rssImageFetchTimeoutMs = 8_000;
const maximumRedirects = 3;

export class SafeImageFetchError extends Error {
  constructor(
    readonly code:
      | "rss_media_blocked"
      | "rss_media_http_error"
      | "rss_media_invalid_content"
      | "rss_media_too_large"
      | "rss_media_unavailable"
      | "rss_media_aborted",
    message: string
  ) {
    super(message);
    this.name = "SafeImageFetchError";
  }
}

export async function fetchSafeRssImage(
  rawUrl: string,
  redirectCount = 0,
  options: { signal?: AbortSignal } = {}
): Promise<{
  body: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  finalUrl: string;
}> {
  throwIfAborted(options.signal);
  const url = parseSafeImageUrl(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname, options.signal);
  throwIfAborted(options.signal);
  const pinnedAddress = addresses[0];
  if (!pinnedAddress) {
    throw new SafeImageFetchError(
      "rss_media_unavailable",
      "De afbeeldingshost heeft geen bruikbaar publiek netwerkadres."
    );
  }
  const response = await requestPinned(
    url,
    pinnedAddress.address,
    pinnedAddress.family,
    options.signal
  );
  throwIfAborted(options.signal);
  if (
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    response.location
  ) {
    if (redirectCount >= maximumRedirects) {
      throw new SafeImageFetchError(
        "rss_media_blocked",
        "De RSS-afbeelding gebruikt te veel redirects."
      );
    }
    let redirected: URL;
    try { redirected = new URL(response.location, url); }
    catch { throw new SafeImageFetchError("rss_media_blocked", "De RSS-afbeelding gebruikt een ongeldige redirect."); }
    return fetchSafeRssImage(
      redirected.toString(),
      redirectCount + 1,
      options
    );
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new SafeImageFetchError(
      "rss_media_http_error",
      `De afbeeldingsserver antwoordde met HTTP ${response.statusCode}.`
    );
  }
  const contentType = normalizeImageContentType(response.contentType);
  if (!contentType || !hasExpectedSignature(response.body, contentType)) {
    throw new SafeImageFetchError(
      "rss_media_invalid_content",
      "De RSS-media is geen geldige JPEG-, PNG- of WebP-afbeelding."
    );
  }
  return {
    body: response.body,
    contentType,
    finalUrl: url.toString()
  };
}

function parseSafeImageUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeImageFetchError(
      "rss_media_blocked",
      "De RSS-media heeft geen geldige publieke HTTP(S)-URL."
    );
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local")
  ) {
    throw new SafeImageFetchError(
      "rss_media_blocked",
      "Alleen publieke RSS-media op standaard HTTP(S)-poorten is toegestaan."
    );
  }
  return url;
}

async function resolvePublicAddresses(hostname: string, signal?: AbortSignal) {
  let addresses: Array<{ address: string; family: number }>;
  try {
    throwIfAborted(signal);
    addresses = await awaitAbort(lookup(hostname, {
      all: true,
      verbatim: true
    }), signal) as Array<{ address: string; family: number }>;
  } catch {
    throwIfAborted(signal);
    throw new SafeImageFetchError(
      "rss_media_unavailable",
      "De afbeeldingshost kon niet veilig worden gevonden."
    );
  }
  throwIfAborted(signal);
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new SafeImageFetchError(
      "rss_media_blocked",
      "De afbeeldingshost verwijst naar een intern of gereserveerd netwerkadres."
    );
  }
  return addresses;
}

function requestPinned(
  url: URL,
  address: string,
  family: number,
  signal?: AbortSignal
): Promise<{
  body: Uint8Array;
  contentType: string;
  location: string | undefined;
  statusCode: number;
}> {
  return new Promise((resolve, reject) => {
    try { throwIfAborted(signal); } catch (error) { reject(error); return; }
    let settled = false;
    let activeResponse: IncomingMessage | undefined;
    let request: ClientRequest;
    const cleanup = () => { signal?.removeEventListener("abort", abort); };
    const fail = (error: SafeImageFetchError) => {
      if (settled) return; settled = true; cleanup();
      activeResponse?.destroy(); request.destroy(); reject(error);
    };
    const abort = () => fail(imageAborted());
    try { request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9",
          "user-agent": "VeyoCast-RSS-Media/1.0"
        },
        lookup: createPinnedLookup(address, family),
        servername: url.hostname,
        signal,
        timeout: rssImageFetchTimeoutMs
      },
      (response) => {
        activeResponse = response;
        if (signal?.aborted) { fail(imageAborted()); return; }
        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > rssImageMaximumBytes
        ) {
          fail(new SafeImageFetchError(
            "rss_media_too_large",
            "De RSS-afbeelding is groter dan de veilige limiet van 8 MB."
          ));
          return;
        }
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on("data", (chunk: Buffer) => {
          if (settled) return;
          byteLength += chunk.byteLength;
          if (byteLength > rssImageMaximumBytes) {
            fail(new SafeImageFetchError(
              "rss_media_too_large",
              "De RSS-afbeelding is groter dan de veilige limiet van 8 MB."
            ));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (settled) return;
          if (signal?.aborted) { fail(imageAborted()); return; }
          settled = true; cleanup();
          resolve({
            body: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? ""),
            location: response.headers.location,
            statusCode: response.statusCode ?? 0
          });
        });
        response.on("error", () => fail(signal?.aborted ? imageAborted() : unavailableImage()));
        response.on("aborted", () => fail(signal?.aborted ? imageAborted() : unavailableImage()));
      }
    ); } catch { settled = true; cleanup(); reject(signal?.aborted ? imageAborted() : unavailableImage()); return; }
    request.on("timeout", () => fail(unavailableImage()));
    request.on("error", (error) => {
      fail(signal?.aborted ? imageAborted() : error instanceof SafeImageFetchError
          ? error
          : unavailableImage());
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    request.end();
  });
}

function imageAborted() { return new SafeImageFetchError("rss_media_aborted", "De RSS-afbeeldingsaanvraag is gestopt."); }
function unavailableImage() { return new SafeImageFetchError("rss_media_unavailable", "De RSS-afbeelding was tijdelijk niet bereikbaar."); }
function throwIfAborted(signal?: AbortSignal) { if (signal?.aborted) throw imageAborted(); }
async function awaitAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      abort = () => reject(imageAborted()); signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener("abort", abort); }
}

function normalizeImageContentType(
  value: string
): "image/jpeg" | "image/png" | "image/webp" | null {
  const normalized = value.split(";")[0]?.trim().toLowerCase();
  return normalized === "image/jpeg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
    ? normalized
    : null;
}

function hasExpectedSignature(
  bytes: Uint8Array,
  contentType: "image/jpeg" | "image/png" | "image/webp"
) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}
