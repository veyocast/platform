import { describe, expect, it } from "vitest";

import { detectImageMime } from "./image-mime";

describe("afbeelding magic-byte detectie", () => {
  it.each([
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"],
    [new Uint8Array([255, 216, 255, 0]), "image/jpeg"],
    [new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBP"), "image/webp"],
    [new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000"), "image/gif"],
    [new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml"]
  ] as const)("herkent inhoud onafhankelijk van extensie als %s", (bytes, mimeType) => {
    expect(detectImageMime(bytes)).toBe(mimeType);
  });

  it("weigert tekst, corrupte headers en binaire SVG-polyglots", () => {
    expect(detectImageMime(new TextEncoder().encode("not-an-image.png"))).toBeNull();
    expect(detectImageMime(new Uint8Array([137, 80, 78]))).toBeNull();
    expect(detectImageMime(new Uint8Array([...new TextEncoder().encode("<svg>"), 0, 1])))
      .toBeNull();
  });
});
