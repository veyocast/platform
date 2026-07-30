export const allowedImageUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const maxImageUploadBytes = 20 * 1024 * 1024;
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
  if (size > maxImageUploadBytes) return "file_too_large";
  if (
    !allowedImageUploadMimeTypes.includes(
      type as (typeof allowedImageUploadMimeTypes)[number]
    )
  ) {
    return "unsupported_mime_type";
  }
  return null;
}

export function imageUploadPolicyMessage(failure: ImageUploadPolicyFailure) {
  if (failure === "empty_file") {
    return "Het bestand bevat geen bruikbare gegevens.";
  }
  if (failure === "file_too_large") {
    return "De afbeelding is groter dan 20 MB. Verklein of comprimeer het bestand en probeer opnieuw.";
  }
  return "Dit bestandstype is niet toegestaan. Gebruik JPEG, PNG of WebP.";
}
