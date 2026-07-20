import "server-only";

import { randomUUID } from "node:crypto";

import { requireTenantCapability } from "../control-session";
import { createControlAdminClient } from "../supabase/admin";
import { createControlSupabaseClient } from "../supabase/server";
import { MediaUploadError } from "./validated-image-upload";

const maxVideoBytes = 500 * 1024 * 1024;

export type VideoUploadCandidate = {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  title: string;
};

export type PreparedVideoUpload = {
  bucket: "tenant-media";
  path: string;
  title: string;
  token: string;
  uploadSessionId: string;
};

export async function prepareValidatedVideoUpload(
  candidate: VideoUploadCandidate
): Promise<PreparedVideoUpload> {
  const { session, supabase } = await requireWritableMediaSession();
  validateCandidate(candidate);

  let admin;
  try {
    admin = createControlAdminClient();
  } catch (error) {
    console.error("Video-upload mist serverconfiguratie", error);
    throw new MediaUploadError(
      "De beveiligde uploadservice is niet beschikbaar. Er is niets aangemaakt; neem contact op met een beheerder."
    );
  }

  const assetId = randomUUID();
  const uploadSessionId = randomUUID();
  const safeFileName = sanitizeVideoFileName(candidate.fileName);
  const storagePath =
    `tenants/${session.tenantId}/assets/${assetId}/original/${safeFileName}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1_000).toISOString();

  const { error: assetError } = await supabase.from("media_assets").insert({
    created_by: session.userId,
    file_size_bytes: candidate.fileSizeBytes,
    id: assetId,
    kind: "video",
    mime_type: "video/mp4",
    original_file_name: safeFileName,
    status: "uploading",
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: session.tenantId,
    title: candidate.title.trim()
  });
  if (assetError) {
    console.error("Videoregistratie mislukt", assetError);
    throw new MediaUploadError(
      "VeyoCast kon de videoregistratie niet maken. Er is geen bestand opgeslagen; probeer opnieuw."
    );
  }

  const { error: sessionError } = await supabase.from("media_upload_sessions").insert({
    asset_id: assetId,
    created_by: session.userId,
    expected_mime_type: "video/mp4",
    expected_size_bytes: candidate.fileSizeBytes,
    expires_at: expiresAt,
    id: uploadSessionId,
    status: "pending",
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: session.tenantId
  });
  if (sessionError) {
    console.error("Video-uploadsessie maken mislukt", sessionError);
    await admin.from("media_assets").delete().eq("id", assetId);
    throw new MediaUploadError(
      "De beveiligde uploadsessie kon niet worden gemaakt. Er is niets opgeslagen; probeer opnieuw."
    );
  }

  const { data, error: signedUrlError } = await admin.storage
    .from("tenant-media")
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (signedUrlError || !data?.token) {
    console.error("Signed video-upload voorbereiden mislukt", signedUrlError);
    await admin.from("media_assets").delete().eq("id", assetId);
    throw new MediaUploadError(
      "De tijdelijke uploadtoegang kon niet worden gemaakt. Er is niets opgeslagen; probeer opnieuw."
    );
  }

  return {
    bucket: "tenant-media",
    path: storagePath,
    title: candidate.title.trim(),
    token: data.token,
    uploadSessionId
  };
}

export async function finalizeValidatedVideoUpload(uploadSessionId: string) {
  const { supabase } = await requireWritableMediaSession();
  if (!isUuid(uploadSessionId)) {
    throw new MediaUploadError(
      "De uploadsessie is ongeldig. De video is niet in verwerking gezet; start de upload opnieuw."
    );
  }

  const { data, error } = await supabase.rpc("finalize_media_video_upload", {
    p_upload_session_id: uploadSessionId
  });
  if (error || !Array.isArray(data) || data.length !== 1) {
    console.error("Video-upload finaliseren mislukt", error);
    throw new MediaUploadError(
      "De opgeslagen video kon nog niet veilig worden geverifieerd en staat niet in de verwerkingsqueue. Probeer de afronding opnieuw."
    );
  }
  return data[0] as { asset_id: string; job_id: string };
}

export async function cancelValidatedVideoUpload(uploadSessionId: string) {
  const { session, supabase } = await requireWritableMediaSession();
  if (!isUuid(uploadSessionId)) return { blocked: false, removed: false };

  const { data, error: sessionReadError } = await supabase
    .from("media_upload_sessions")
    .select("asset_id, storage_bucket, storage_path, status, tenant_id")
    .eq("id", uploadSessionId)
    .eq("tenant_id", session.tenantId)
    .maybeSingle();
  if (sessionReadError || !data || data.status !== "pending") {
    return { blocked: false, removed: false };
  }

  const admin = createControlAdminClient();
  const { error: removalError } = await admin.storage
    .from(data.storage_bucket)
    .remove([data.storage_path]);
  const { error: sessionUpdateError } = await admin
    .from("media_upload_sessions")
    .update({ status: "cancelled" })
    .eq("id", uploadSessionId);
  const { error: assetUpdateError } = await admin
    .from("media_assets")
    .update({
      status: "validation_failed",
      validation_error: "client_upload_failed"
    })
    .eq("tenant_id", session.tenantId)
    .eq("id", data.asset_id);
  return {
    blocked: !sessionUpdateError && !assetUpdateError,
    removed: !removalError
  };
}

async function requireWritableMediaSession() {
  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    throw new MediaUploadError(
      "Uploaden is alleen beschikbaar met een actieve Supabase-sessie. Log opnieuw in en probeer het daarna nogmaals."
    );
  }
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

function validateCandidate(candidate: VideoUploadCandidate) {
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (title.length < 2 || title.length > 120) {
    throw new MediaUploadError(
      "Gebruik een videotitel van 2 tot en met 120 tekens. De upload is niet gestart."
    );
  }
  if (
    typeof candidate.fileName !== "string" ||
    candidate.fileName.length > 255 ||
    !/\.mp4$/i.test(candidate.fileName)
  ) {
    throw new MediaUploadError(
      "Alleen een bestand met de extensie .mp4 kan worden verwerkt. Kies een MP4-video."
    );
  }
  if (candidate.mimeType !== "video/mp4") {
    throw new MediaUploadError(
      "Het gedeclareerde bestandstype is geen MP4. Er is niets opgeslagen; kies een MP4-video."
    );
  }
  if (
    !Number.isSafeInteger(candidate.fileSizeBytes) ||
    candidate.fileSizeBytes <= 0 ||
    candidate.fileSizeBytes > maxVideoBytes
  ) {
    throw new MediaUploadError(
      "De video is leeg of groter dan 500 MB. Kies een MP4-video van maximaal 500 MB."
    );
  }
}

function sanitizeVideoFileName(fileName: string) {
  const baseName =
    fileName
      .replace(/^.*[\\/]/, "")
      .replace(/\.mp4$/i, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "video";
  return `${baseName}.mp4`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
