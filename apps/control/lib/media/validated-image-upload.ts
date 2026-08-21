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
import { detectImageMime } from "./image-mime";
import {
  createImageThumbnail,
  normalizeRasterImage
} from "./raster-normalization";
import {
  isTintableSvgBytes,
  sanitizeSvgBytes,
  SvgSanitizationError
} from "./svg-sanitizer";

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
      "Er is geen bruikbare afbeelding gekozen. Kies een JPEG-, PNG-, WebP-, GIF- of veilig SVG-bestand met inhoud."
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

  const receivedBytes = Buffer.from(await candidate.arrayBuffer());
  const detectedMimeType = detectImageMime(receivedBytes);

  if (
    !detectedMimeType ||
    !allowedImageUploadMimeTypes.includes(detectedMimeType) ||
    detectedMimeType !== candidate.type
  ) {
    throw new MediaUploadError(
      "De bestandsinhoud komt niet overeen met het opgegeven type. Er is niets opgeslagen; kies een geldige afbeelding."
    );
  }

  let bytes: Uint8Array = receivedBytes;
  if (detectedMimeType === "image/svg+xml") {
    try {
      bytes = sanitizeSvgBytes(receivedBytes);
    } catch (error) {
      if (error instanceof SvgSanitizationError && error.code === "invalid-encoding") {
        throw new MediaUploadError(
          "Het SVG-bestand is geen geldige UTF-8-tekst. Er is niets opgeslagen; exporteer het logo opnieuw."
        );
      }
      throw new MediaUploadError(
        error instanceof SvgSanitizationError && error.code === "active-content"
          ? "Het SVG-bestand bevat actieve of externe inhoud. Er is niets opgeslagen; verwijder scripts, events, externe links en ingesloten objecten."
          : "Het SVG-bestand is niet volledig of heeft geen geldige SVG-root. Er is niets opgeslagen; exporteer het logo opnieuw."
      );
    }
  } else if (
    detectedMimeType === "image/jpeg" ||
    detectedMimeType === "image/png" ||
    detectedMimeType === "image/webp"
  ) {
    try {
      bytes = await normalizeRasterImage(receivedBytes, detectedMimeType);
    } catch {
      throw new MediaUploadError(
        "De afbeelding kon niet binnen de veilige pixel- en decoderlimieten worden verwerkt. Er is niets opgeslagen; exporteer het bestand opnieuw."
      );
    }
  }

  const dimensions = readImageDimensions(bytes, detectedMimeType);
  if (!dimensions) {
    throw new MediaUploadError(
      "De afbeelding bevat geen geldige, begrensde breedte en hoogte. Er is niets opgeslagen; exporteer het bestand opnieuw."
    );
  }

  let thumbnail: Awaited<ReturnType<typeof createImageThumbnail>> | null = null;
  if (detectedMimeType !== "image/gif") {
    try {
      thumbnail = await createImageThumbnail(bytes, detectedMimeType);
    } catch {
      throw new MediaUploadError(
        "De afbeelding kon niet tot een veilige bibliotheekthumbnail worden verwerkt. Er is niets opgeslagen; exporteer het bestand opnieuw."
      );
    }
  }

  const assetId = randomUUID();
  const safeFileName = sanitizeFileName(candidate.name, detectedMimeType);
  const storagePath =
    `tenants/${tenantId}/assets/${assetId}/original/${safeFileName}`;
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const thumbnailStoragePath = thumbnail
    ? `tenants/${tenantId}/assets/${assetId}/thumbnail/thumbnail.${thumbnail.mimeType === "image/png" ? "png" : "webp"}`
    : null;
  const thumbnailChecksumSha256 = thumbnail
    ? createHash("sha256").update(thumbnail.bytes).digest("hex")
    : null;
  const tintable = detectedMimeType === "image/svg+xml" && isTintableSvgBytes(bytes);

  const { error: assetError } = await supabase.from("media_assets").insert({
    created_by: userId,
    file_size_bytes: bytes.byteLength,
    height: dimensions.height,
    id: assetId,
    kind: detectedMimeType === "image/gif" ? "video" : "image",
    mime_type: detectedMimeType,
    original_file_name: safeFileName,
    status: "uploading",
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: tenantId,
    title,
    tintable,
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


  if (thumbnail && thumbnailStoragePath) {
    const { error: thumbnailStorageError } = await admin.storage
      .from("tenant-media")
      .upload(thumbnailStoragePath, thumbnail.bytes, {
        cacheControl: "31536000",
        contentType: thumbnail.mimeType,
        upsert: false
      });
    if (thumbnailStorageError) {
      console.error("Private mediathumbnail-upload mislukt", thumbnailStorageError);
      await admin.storage.from("tenant-media").remove([storagePath]);
      await markValidationFailed(admin, assetId, "thumbnail_storage_upload_failed");
      throw new MediaUploadError(
        "De afbeelding is ontvangen, maar de veilige thumbnail kon niet worden opgeslagen. Het bronbestand is verwijderd; probeer opnieuw."
      );
    }
  }

  if (detectedMimeType === "image/gif") {
    const { data: job, error: jobError } = await admin
      .from("media_processing_jobs")
      .insert({ asset_id: assetId, requested_by: userId, tenant_id: tenantId })
      .select("id")
      .single();
    const { error: processingError } = jobError || !job
      ? { error: jobError ?? new Error("processing_job_missing") }
      : await admin
          .from("media_assets")
          .update({ status: "processing", validation_error: null })
          .eq("id", assetId)
          .eq("tenant_id", tenantId);
    if (processingError) {
      console.error("GIF-verwerking starten mislukt", processingError);
      if (job?.id) await admin.from("media_processing_jobs").delete().eq("id", job.id);
      await admin.storage.from("tenant-media").remove([storagePath]);
      await markValidationFailed(admin, assetId, "processing_queue_failed");
      throw new MediaUploadError(
        "De GIF is veilig ontvangen, maar kon niet in de animatieverwerking worden gezet. Het bestand wordt niet uitgeleverd; probeer opnieuw."
      );
    }
    return { assetId, processing: true, title };
  }

  const { error: variantError } = await admin.from("media_variants").insert([
    {
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
    },
    ...(thumbnail && thumbnailStoragePath && thumbnailChecksumSha256 ? [{
      asset_id: assetId,
      checksum_sha256: thumbnailChecksumSha256,
      file_size_bytes: thumbnail.bytes.byteLength,
      height: thumbnail.height,
      mime_type: thumbnail.mimeType,
      storage_bucket: "tenant-media",
      storage_path: thumbnailStoragePath,
      tenant_id: tenantId,
      variant_type: "thumbnail",
      width: thumbnail.width
    }] : [])
  ]);

  if (variantError) {
    console.error("Mediavariant registreren mislukt", variantError);
    await admin.storage.from("tenant-media").remove([
      storagePath,
      ...(thumbnailStoragePath ? [thumbnailStoragePath] : [])
    ]);
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
    await admin.storage.from("tenant-media").remove([
      storagePath,
      ...(thumbnailStoragePath ? [thumbnailStoragePath] : [])
    ]);
    await markValidationFailed(admin, assetId, "ready_transition_failed");
    throw new MediaUploadError(
      "De upload kon niet veilig worden afgerond. Het bestand is verwijderd en wordt niet aan playlists aangeboden; probeer opnieuw."
    );
  }

  return { assetId, processing: false, title };
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

function sanitizeFileName(fileName: string, mimeType: string) {
  const extension = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
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
