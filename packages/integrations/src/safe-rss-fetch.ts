import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export const rssFetchMaximumBytes = 2_000_000;
export const rssFetchTimeoutMs = 8_000;
const maximumRedirects = 3;

export class SafeRssFetchError extends Error {
  constructor(
    readonly code:
      | "rss_fetch_blocked"
      | "rss_fetch_http_error"
      | "rss_fetch_invalid_content"
      | "rss_fetch_too_large"
      | "rss_fetch_unavailable",
    message: string
  ) {
    super(message);
    this.name = "SafeRssFetchError";
  }
}

export async function fetchSafeRss(
  rawUrl: string,
  redirectCount = 0
): Promise<{ body: string; finalUrl: string }> {
  const url = parseSafeUrl(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname);
  const pinnedAddress = addresses[0];
  if (!pinnedAddress) {
    throw new SafeRssFetchError(
      "rss_fetch_unavailable",
      "De feedhost heeft geen bruikbaar publiek netwerkadres."
    );
  }
  const response = await requestPinned(url, pinnedAddress.address, pinnedAddress.family);
  if (
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    response.location
  ) {
    if (redirectCount >= maximumRedirects) {
      throw new SafeRssFetchError(
        "rss_fetch_blocked",
        "De feed gebruikt te veel redirects."
      );
    }
    const redirectUrl = new URL(response.location, url);
    return fetchSafeRss(redirectUrl.toString(), redirectCount + 1);
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new SafeRssFetchError(
      "rss_fetch_http_error",
      `De feedserver antwoordde met HTTP ${response.statusCode}.`
    );
  }
  const contentType = response.contentType.toLowerCase();
  if (
    contentType &&
    !contentType.includes("xml") &&
    !contentType.includes("rss") &&
    !contentType.includes("atom") &&
    !contentType.startsWith("text/plain")
  ) {
    throw new SafeRssFetchError(
      "rss_fetch_invalid_content",
      "De URL levert geen RSS-, Atom- of XML-inhoud."
    );
  }
  return { body: response.body, finalUrl: url.toString() };
}

function parseSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeRssFetchError(
      "rss_fetch_blocked",
      "Gebruik een volledige publieke HTTP(S)-feed-URL."
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
    throw new SafeRssFetchError(
      "rss_fetch_blocked",
      "Alleen publieke HTTP(S)-feeds op standaardpoorten zijn toegestaan."
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
    throw new SafeRssFetchError(
      "rss_fetch_unavailable",
      "De feedhost kon niet veilig worden gevonden."
    );
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new SafeRssFetchError(
      "rss_fetch_blocked",
      "De feedhost verwijst naar een intern of gereserveerd netwerkadres."
    );
  }
  return addresses;
}

function requestPinned(
  url: URL,
  address: string,
  family: number
): Promise<{
  body: string;
  contentType: string;
  location: string | undefined;
  statusCode: number;
}> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        headers: {
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/plain;q=0.5",
          "user-agent": "VeyoCast-RSS/1.0"
        },
        lookup(_hostname, _options, callback) {
          callback(null, address, family);
        },
        servername: url.hostname,
        timeout: rssFetchTimeoutMs
      },
      (response) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on("data", (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > rssFetchMaximumBytes) {
            request.destroy(new SafeRssFetchError(
              "rss_fetch_too_large",
              "De feed is groter dan de veilige limiet van 2 MB."
            ));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
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
        error instanceof SafeRssFetchError
          ? error
          : new SafeRssFetchError(
              "rss_fetch_unavailable",
              "De feed was tijdelijk niet bereikbaar."
            )
      );
    });
    request.end();
  });
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      return isPublicIp(normalized.slice(7));
    }
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return false;
}
