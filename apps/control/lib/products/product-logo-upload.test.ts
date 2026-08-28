import { describe, expect, it } from "vitest";

import {
  productLogoTitle,
  readLogoCommandOutcome,
  validateProductLogoFile
} from "./product-logo-upload";

describe("productlogo-upload", () => {
  it("accepteert begrensde statische logoformaten", () => {
    expect(validateProductLogoFile({ size: 1_024, type: "image/png" })).toBeNull();
    expect(validateProductLogoFile({ size: 1_024, type: "image/svg+xml" })).toBeNull();
  });

  it("weigert animatie en onveilige bestandstypen", () => {
    expect(validateProductLogoFile({ size: 1_024, type: "image/gif" })).toBe("animated_image");
    expect(validateProductLogoFile({ size: 1_024, type: "text/html" })).toBe("unsupported_mime_type");
  });

  it("begrensd de mediatitel en leest alleen een geldig commandresultaat", () => {
    expect(productLogoTitle("x".repeat(200))).toHaveLength(120);
    expect(readLogoCommandOutcome({ outcome: "updated", revision: 4, mediaAssetId: "asset" })).toEqual({
      actualRevision: null,
      mediaAssetId: "asset",
      outcome: "updated",
      revision: 4
    });
    expect(readLogoCommandOutcome([])).toBeNull();
  });
});
