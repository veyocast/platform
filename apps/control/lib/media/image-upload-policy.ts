export const allowedImageUploadMimeTypes = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp"
] as const;

export const maxImageUploadBytes = 50 * 1024 * 1024;
export const maxRasterImageUploadBytes = 25 * 1024 * 1024;
export const maxSvgUploadBytes = 2 * 1024 * 1024;
export const maxImageUploadBatchSize = 12;

export type ImageUploadPolicyFailure =
  | "empty_file"
  | "file_too_large"
  | "unsupported_mime_type";

export function validateImageUploadFile({
  size,
  type
}: {
  size: number;
  type: string;
}): ImageUploadPolicyFailure | null {
  if (!Number.isFinite(size) || size <= 0) return "empty_file";
  if (
    !allowedImageUploadMimeTypes.includes(
      type as (typeof allowedImageUploadMimeTypes)[number]
    )
  ) {
    return "unsupported_mime_type";
  }
  const limit = type === "image/gif"
    ? maxImageUploadBytes
    : type === "image/svg+xml" ? maxSvgUploadBytes : maxRasterImageUploadBytes;
  if (size > limit) return "file_too_large";
  return null;
}

export function imageUploadPolicyMessage(failure: ImageUploadPolicyFailure) {
  if (failure === "empty_file") {
    return "Het bestand bevat geen bruikbare gegevens.";
  }
  if (failure === "file_too_large") {
    return "Het bestand overschrijdt de veilige limiet: 25 MB voor afbeeldingen, 50 MB voor GIF en 2 MB voor SVG. Verklein het bestand en probeer opnieuw.";
  }
  return "Dit bestandstype is niet toegestaan. Gebruik JPEG, PNG, WebP, GIF of een veilig SVG-bestand.";
}
