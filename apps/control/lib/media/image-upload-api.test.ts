import { describe, expect, it } from "vitest";

import {
  isImageUploadRequestTooLarge,
  isTrustedImageUploadOrigin,
  maxImageUploadRequestBytes,
  readImageUploadContentLength
} from "./image-upload-api";

describe("image upload API transport policy", () => {
  it("accepts the exact bounded multipart budget and rejects larger requests", () => {
    expect(
      isImageUploadRequestTooLarge(String(maxImageUploadRequestBytes))
    ).toBe(false);
    expect(
      isImageUploadRequestTooLarge(String(maxImageUploadRequestBytes + 1))
    ).toBe(true);
  });

  it("leaves missing or malformed lengths to file-level validation", () => {
    expect(readImageUploadContentLength(null)).toBeNull();
    expect(readImageUploadContentLength("not-a-number")).toBeNull();
    expect(isImageUploadRequestTooLarge(null)).toBe(false);
  });

  it("accepts only the effective same origin, including a trusted proxy host", () => {
    expect(
      isTrustedImageUploadOrigin({
        forwardedHost: "control.veyocast.nl",
        host: "127.0.0.1:3000",
        origin: "https://control.veyocast.nl"
      })
    ).toBe(true);
    expect(
      isTrustedImageUploadOrigin({
        forwardedHost: "control.veyocast.nl",
        host: "127.0.0.1:3000",
        origin: "https://example.test"
      })
    ).toBe(false);
    expect(
      isTrustedImageUploadOrigin({
        forwardedHost: null,
        host: "control.veyocast.nl",
        origin: null
      })
    ).toBe(false);
  });
});
