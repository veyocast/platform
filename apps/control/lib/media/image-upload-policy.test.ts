import { describe, expect, it } from "vitest";

import {
  maxImageUploadBytes,
  maxRasterImageUploadBytes,
  maxSvgUploadBytes,
  validateImageUploadFile
} from "./image-upload-policy";

describe("image upload policy", () => {
  it("accepts a supported image at the documented limit", () => {
    expect(
      validateImageUploadFile({
        size: maxRasterImageUploadBytes,
        type: "image/png"
      })
    ).toBeNull();
  });

  it("rejects oversized files before starting a server action", () => {
    expect(
      validateImageUploadFile({
        size: maxRasterImageUploadBytes + 1,
        type: "image/png"
      })
    ).toBe("file_too_large");
  });

  it("accepteert geanimeerde en veilig te sanitiseren beeldformaten", () => {
    expect(validateImageUploadFile({ size: 1024, type: "image/gif" })).toBeNull();
    expect(validateImageUploadFile({ size: 1024, type: "image/svg+xml" })).toBeNull();
    expect(validateImageUploadFile({ size: maxImageUploadBytes, type: "image/gif" })).toBeNull();
    expect(validateImageUploadFile({ size: maxSvgUploadBytes + 1, type: "image/svg+xml" }))
      .toBe("file_too_large");
  });

  it("rejects empty or unsupported files before transport", () => {
    expect(validateImageUploadFile({ size: 0, type: "image/png" })).toBe(
      "empty_file"
    );
    expect(
      validateImageUploadFile({ size: 1024, type: "application/pdf" })
    ).toBe("unsupported_mime_type");
  });
});
