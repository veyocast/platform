import { describe, expect, it } from "vitest";

import { resolveMediaPreviewGeometry } from "./media-preview-geometry";

describe("media-previewgeometrie", () => {
  it("behoudt de staande verhouding van 1080 × 1920-media", () => {
    expect(resolveMediaPreviewGeometry(1080, 1920)).toEqual({
      aspectRatio: "1080 / 1920",
      label: "1080 × 1920 · Staand",
      orientation: "portrait"
    });
  });

  it("herkent liggende en vierkante media", () => {
    expect(resolveMediaPreviewGeometry(1920, 1080).orientation).toBe(
      "landscape"
    );
    expect(resolveMediaPreviewGeometry(1080, 1080).orientation).toBe("square");
  });

  it("valt veilig terug wanneer dimensies ontbreken", () => {
    expect(resolveMediaPreviewGeometry(null, 1920)).toEqual({
      aspectRatio: undefined,
      label: null,
      orientation: "unknown"
    });
  });
});
