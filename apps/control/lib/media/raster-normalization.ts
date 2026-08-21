import sharp from "sharp";

export type NormalizedRasterMimeType = "image/jpeg" | "image/png" | "image/webp";
export type ThumbnailSourceMimeType = NormalizedRasterMimeType | "image/svg+xml";

export async function normalizeRasterImage(
  bytes: Uint8Array,
  mimeType: NormalizedRasterMimeType
) {
  const pipeline = sharp(bytes, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 67_108_864
  }).rotate();
  if (mimeType === "image/jpeg") {
    return pipeline.jpeg({ mozjpeg: true, quality: 92 }).toBuffer();
  }
  if (mimeType === "image/png") {
    return pipeline.png({ compressionLevel: 9 }).toBuffer();
  }
  return pipeline.webp({ quality: 90 }).toBuffer();
}

export async function createImageThumbnail(
  bytes: Uint8Array,
  sourceMimeType: ThumbnailSourceMimeType
) {
  const pipeline = sharp(bytes, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 67_108_864
  }).rotate().resize({
    fit: "inside",
    height: 320,
    kernel: sharp.kernel.lanczos3,
    width: 320,
    withoutEnlargement: true
  });
  const mimeType = sourceMimeType === "image/svg+xml" ? "image/png" as const : "image/webp" as const;
  const output = mimeType === "image/png"
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await pipeline.webp({ effort: 5, quality: 84 }).toBuffer({ resolveWithObject: true });
  if (!output.info.width || !output.info.height) {
    throw new Error("thumbnail_dimensions_missing");
  }
  return {
    bytes: output.data,
    height: output.info.height,
    mimeType,
    width: output.info.width
  };
}
