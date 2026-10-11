import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { detectImageMime } from "./image-mime";

import {
  createImageThumbnail,
  normalizeRasterImage
} from "./raster-normalization";

describe("veilige raster-normalisatie", () => {
  it("decodeert echte AVIF naar metadata-vrije WebP met dezelfde alpha en afmetingen", async () => {
    const source = await sharp({
      create: { background: { r: 20, g: 100, b: 200, alpha: 0.5 }, channels: 4, height: 12, width: 18 }
    }).avif().withMetadata().toBuffer();
    expect(detectImageMime(source)).toBe("image/avif");
    const output = await normalizeRasterImage(source, "image/avif");
    expect(detectImageMime(output)).toBe("image/webp");
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 18, height: 12, hasAlpha: true });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    await expect(normalizeRasterImage(source.subarray(0, 32), "image/avif")).rejects.toThrow();
    await expect(normalizeRasterImage(output, "image/avif")).rejects.toThrow("invalid_static_avif");
  });
  it("past EXIF-rotatie toe en levert JPEG zonder metadata uit", async () => {
    const source = await sharp({
      create: { background: "#ff5c20", channels: 3, height: 20, width: 10 }
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await normalizeRasterImage(source, "image/jpeg");
    const metadata = await sharp(result).metadata();

    expect(metadata).toMatchObject({ format: "jpeg", height: 10, width: 20 });
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"]
  ] as const)("decodeert en normaliseert %s server-side", async (mimeType, format) => {
    const source = await sharp({
      create: { background: { alpha: 0.5, b: 0, g: 80, r: 255 }, channels: 4, height: 16, width: 24 }
    }).png().toBuffer();
    const result = await normalizeRasterImage(source, mimeType);
    expect(await sharp(result).metadata()).toMatchObject({ format, height: 16, width: 24 });
  });

  it("weigert corrupte decoderinput", async () => {
    await expect(normalizeRasterImage(new Uint8Array([1, 2, 3]), "image/png"))
      .rejects.toThrow();
  });

  it("maakt een begrensde WebP-thumbnail zonder upscaling", async () => {
    const source = await sharp({
      create: { background: "#ff5c20", channels: 3, height: 320, width: 640 }
    }).png().toBuffer();
    const result = await createImageThumbnail(source, "image/png");
    expect(result).toMatchObject({ height: 160, mimeType: "image/webp", width: 320 });
    expect(await sharp(result.bytes).metadata()).toMatchObject({ format: "webp", height: 160, width: 320 });
  });

  it("rastert een geschoonde SVG-thumbnail naar PNG", async () => {
    const source = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#ff5c20"/></svg>'
    );
    const result = await createImageThumbnail(source, "image/svg+xml");
    expect(result).toMatchObject({ height: 160, mimeType: "image/png", width: 320 });
    expect(await sharp(result.bytes).metadata()).toMatchObject({ format: "png", height: 160, width: 320 });
  });
});
