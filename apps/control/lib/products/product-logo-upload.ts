import {
  imageUploadPolicyMessage,
  validateImageUploadFile
} from "../media/image-upload-policy";

export const productLogoMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp"
] as const;

export type ProductLogoValidationFailure =
  | "animated_image"
  | "empty_file"
  | "file_too_large"
  | "unsupported_mime_type";

export type ProductLogoApiResult =
  | {
      data: {
        assetId: string | null;
        message: string;
        previewUrl: string | null;
        revision: number;
      };
      ok: true;
      requestId: string;
    }
  | {
      error: {
        code:
          | "CONFLICT"
          | "FORBIDDEN"
          | "INVALID_FILE"
          | "INVALID_ORIGIN"
          | "NOT_FOUND"
          | "REQUEST_TOO_LARGE"
          | "SESSION_EXPIRED"
          | "TEMPORARILY_UNAVAILABLE";
        message: string;
        recovery: string;
      };
      ok: false;
      requestId: string;
    };

export function validateProductLogoFile({
  size,
  type
}: {
  size: number;
  type: string;
}): ProductLogoValidationFailure | null {
  if (type === "image/gif") return "animated_image";
  const failure = validateImageUploadFile({ size, type });
  if (failure) return failure;
  return productLogoMimeTypes.includes(
    type as (typeof productLogoMimeTypes)[number]
  )
    ? null
    : "unsupported_mime_type";
}

export function productLogoValidationMessage(
  failure: ProductLogoValidationFailure
) {
  if (failure === "animated_image") {
    return "Een productlogo moet een stilstaand beeld zijn. Gebruik JPEG, PNG, WebP of een veilig SVG-bestand.";
  }
  return imageUploadPolicyMessage(failure);
}

export function productLogoTitle(productName: string) {
  return `Productlogo · ${productName}`.slice(0, 120);
}

export function readLogoCommandOutcome(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    actualRevision:
      typeof record.actualRevision === "number" ? record.actualRevision : null,
    mediaAssetId:
      typeof record.mediaAssetId === "string" ? record.mediaAssetId : null,
    outcome: typeof record.outcome === "string" ? record.outcome : null,
    revision: typeof record.revision === "number" ? record.revision : null
  };
}
