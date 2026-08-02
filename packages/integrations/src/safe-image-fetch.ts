import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
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
      | "rss_media_unavailable",
    message: string
  ) {
    super(message);
    this.name = "SafeImageFetchError";
  }
}

export async function fetchSafeRssImage(
  rawUrl: string,
  redirectCount = 0
): Promise<{
  body: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  finalUrl: string;
}> {
  const url = parseSafeImageUrl(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname);
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
    pinnedAddress.family
  );
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
    return fetchSafeRssImage(
      new URL(response.location, url).toString(),
      redirectCount + 1
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

async function resolvePublicAddresses(hostname: string) {
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, {
      all: true,
      verbatim: true
    }) as Array<{ address: string; family: number }>;
  } catch {
    throw new SafeImageFetchError(
      "rss_media_unavailable",
      "De afbeeldingshost kon niet veilig worden gevonden."
    );
  }
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
  family: number
): Promise<{
  body: Uint8Array;
  contentType: string;
  location: string | undefined;
  statusCode: number;
}> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9",
          "user-agent": "VeyoCast-RSS-Media/1.0"
        },
        lookup: createPinnedLookup(address, family),
        servername: url.hostname,
        timeout: rssImageFetchTimeoutMs
      },
      (response) => {
        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > rssImageMaximumBytes
        ) {
          request.destroy(new SafeImageFetchError(
            "rss_media_too_large",
            "De RSS-afbeelding is groter dan de veilige limiet van 8 MB."
          ));
          return;
        }
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on("data", (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > rssImageMaximumBytes) {
            request.destroy(new SafeImageFetchError(
              "rss_media_too_large",
              "De RSS-afbeelding is groter dan de veilige limiet van 8 MB."
            ));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? ""),
            location: response.headers.location,
            statusCode: response.statusCode ?? 0
          });
        });
      }
    );
    request.on("timeout", () => request.destroy());
    request.on("error", (error) => {
      reject(
        error instanceof SafeImageFetchError
          ? error
          : new SafeImageFetchError(
              "rss_media_unavailable",
              "De RSS-afbeelding was tijdelijk niet bereikbaar."
            )
      );
    });
    request.end();
  });
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
