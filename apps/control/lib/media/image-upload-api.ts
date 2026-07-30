import { maxImageUploadBytes } from "./image-upload-policy";

export const maxImageUploadRequestBytes =
  maxImageUploadBytes + 1024 * 1024;

export type ImageUploadApiResult =
  | {
      data: {
        assetId: string;
        title: string;
      };
      ok: true;
      requestId: string;
    }
  | {
      error: {
        code:
          | "FORBIDDEN"
          | "INVALID_FILE"
          | "INVALID_ORIGIN"
          | "REQUEST_TOO_LARGE"
          | "SESSION_EXPIRED"
          | "TEMPORARILY_UNAVAILABLE";
        message: string;
        recovery: string;
      };
      ok: false;
      requestId: string;
    };

export function readImageUploadContentLength(
  rawContentLength: string | null
) {
  if (rawContentLength === null || rawContentLength.trim() === "") {
    return null;
  }
  const value = Number(rawContentLength);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function isImageUploadRequestTooLarge(
  rawContentLength: string | null
) {
  const contentLength = readImageUploadContentLength(rawContentLength);
  return (
    contentLength !== null &&
    contentLength > maxImageUploadRequestBytes
  );
}

export function isTrustedImageUploadOrigin({
  forwardedHost,
  host,
  origin
}: {
  forwardedHost: string | null;
  host: string | null;
  origin: string | null;
}) {
  const effectiveHost = (forwardedHost?.split(",")[0] ?? host)
    ?.trim()
    .toLowerCase();
  if (!effectiveHost || !origin) return false;

  try {
    return new URL(origin).host.toLowerCase() === effectiveHost;
  } catch {
    return false;
  }
}
