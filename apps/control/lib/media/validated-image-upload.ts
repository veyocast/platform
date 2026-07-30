import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireTenantCapability } from "../control-session";
import { createControlAdminClient } from "../supabase/admin";
import { createControlSupabaseClient } from "../supabase/server";
import {
  allowedImageUploadMimeTypes,
  imageUploadPolicyMessage,
  validateImageUploadFile
} from "./image-upload-policy";
import { readImageDimensions } from "./image-dimensions";

export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export async function uploadValidatedImage(formData: FormData) {
  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  const candidate = formData.get("media");
  const title = String(formData.get("title") ?? "").trim();

  if (!session.isLive || !session.tenantId || !supabase) {
    throw new MediaUploadError(
      "Uploaden is alleen beschikbaar met een actieve Supabase-sessie. Log opnieuw in en probeer het daarna nogmaals."
    );
  }

  return uploadValidatedImageCandidate({
    candidate,
    supabase,
    tenantId: session.tenantId,
    title,
    userId: session.userId
  });
}

export async function uploadValidatedImageCandidate({
  candidate,
  supabase,
  tenantId,
  title,
  userId
}: {
  candidate: FormDataEntryValue | null;
  supabase: SupabaseClient;
  tenantId: string;
  title: string;
  userId: string;
}) {

  if (!(candidate instanceof File) || candidate.size === 0) {
    throw new MediaUploadError(
      "Er is geen bruikbare afbeelding gekozen. Kies een JPEG-, PNG- of WebP-bestand met inhoud."
    );
  }

  if (!title || title.length < 2 || title.length > 120) {
    throw new MediaUploadError(
      "Gebruik een titel van 2 tot en met 120 tekens. De upload is niet gestart."
    );
  }

  const policyFailure = validateImageUploadFile(candidate);
  if (policyFailure) {
    throw new MediaUploadError(imageUploadPolicyMessage(policyFailure));
  }

  const bytes = Buffer.from(await candidate.arrayBuffer());
  const detectedMimeType = detectImageMime(bytes);

  if (
    !detectedMimeType ||
    !allowedImageUploadMimeTypes.includes(detectedMimeType) ||
    detectedMimeType !== candidate.type
  ) {
    throw new MediaUploadError(
      "De bestandsinhoud komt niet overeen met het opgegeven type. Er is niets opgeslagen; kies een geldige afbeelding."
    );
  }

  const dimensions = readImageDimensions(bytes, detectedMimeType);
  if (!dimensions) {
    throw new MediaUploadError(
      "De afbeelding bevat geen geldige breedte en hoogte. Er is niets opgeslagen; exporteer het bestand opnieuw als JPEG, PNG of WebP."
    );
  }

  const assetId = randomUUID();
  const safeFileName = sanitizeFileName(candidate.name, detectedMimeType);
  const storagePath =
    `tenants/${tenantId}/assets/${assetId}/original/${safeFileName}`;
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: assetError } = await supabase.from("media_assets").insert({
    created_by: userId,
    file_size_bytes: bytes.byteLength,
    height: dimensions.height,
    id: assetId,
    kind: "image",
    mime_type: detectedMimeType,
    original_file_name: safeFileName,
    status: "uploading",
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: tenantId,
    title,
    width: dimensions.width
  });

  if (assetError) {
    console.error("Mediaregistratie mislukt", assetError);
    throw new MediaUploadError(
      "VeyoCast kon de mediaregistratie niet maken. Er is geen bestand opgeslagen; probeer opnieuw."
    );
  }

  let admin;
  try {
    admin = createControlAdminClient();
  } catch (error) {
    console.error("Media-upload mist serverconfiguratie", error);
    await supabase
      .from("media_assets")
      .update({
        status: "validation_failed",
        validation_error: "server_upload_unavailable"
      })
      .eq("id", assetId);
    throw new MediaUploadError(
      "De beveiligde uploadservice is niet beschikbaar. Er is geen bestand opgeslagen; neem contact op met een beheerder."
    );
  }

  const { error: storageError } = await admin.storage
    .from("tenant-media")
    .upload(storagePath, bytes, {
      cacheControl: "31536000",
      contentType: detectedMimeType,
      upsert: false
    });

  if (storageError) {
    console.error("Private media-upload mislukt", storageError);
    await markValidationFailed(admin, assetId, "storage_upload_failed");
    throw new MediaUploadError(
      "Het bestand kon niet in de private mediaopslag worden gezet. Het item is als mislukt gemarkeerd; probeer opnieuw."
    );
  }

  const { error: variantError } = await admin.from("media_variants").insert({
    asset_id: assetId,
    checksum_sha256: checksumSha256,
    file_size_bytes: bytes.byteLength,
    height: dimensions.height,
    mime_type: detectedMimeType,
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: tenantId,
    variant_type: "original",
    width: dimensions.width
  });

  if (variantError) {
    console.error("Mediavariant registreren mislukt", variantError);
    await admin.storage.from("tenant-media").remove([storagePath]);
    await markValidationFailed(admin, assetId, "variant_registration_failed");
    throw new MediaUploadError(
      "De geverifieerde variant kon niet worden geregistreerd. Het bestand is verwijderd en het item is als mislukt gemarkeerd; probeer opnieuw."
    );
  }

  const { error: readyError } = await admin
    .from("media_assets")
    .update({
      checksum_sha256: checksumSha256,
      processed_at: new Date().toISOString(),
      status: "ready",
      validation_error: null
    })
    .eq("id", assetId);

  if (readyError) {
    console.error("Media gereed melden mislukt", readyError);
    await admin.from("media_variants").delete().eq("asset_id", assetId);
    await admin.storage.from("tenant-media").remove([storagePath]);
    await markValidationFailed(admin, assetId, "ready_transition_failed");
    throw new MediaUploadError(
      "De upload kon niet veilig worden afgerond. Het bestand is verwijderd en wordt niet aan playlists aangeboden; probeer opnieuw."
    );
  }

  return { assetId, title };
}

async function markValidationFailed(
  admin: ReturnType<typeof createControlAdminClient>,
  assetId: string,
  validationError: string
) {
  await admin
    .from("media_assets")
    .update({
      status: "validation_failed",
      validation_error: validationError
    })
    .eq("id", assetId);
}

function detectImageMime(bytes: Buffer) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function sanitizeFileName(fileName: string, mimeType: string) {
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[mimeType];
  const baseName =
    fileName
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "media";

  return `${baseName}.${extension}`;
}
