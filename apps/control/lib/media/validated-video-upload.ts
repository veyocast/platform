import "server-only";

import { requireTenantCapability } from "../control-session";
import { createControlAdminClient } from "../supabase/admin";
import { createControlSupabaseClient } from "../supabase/server";
import { MediaUploadError } from "./validated-image-upload";

const maxVideoBytes = 500 * 1024 * 1024;

export type VideoUploadCandidate = {
  fileName: string;
  fileSizeBytes: number;
  idempotencyKey: string;
  mimeType: string;
  title: string;
};

export type PreparedVideoUpload = {
  bucket: "tenant-media";
  expiresAt: string;
  path: string;
  resumed: boolean;
  title: string;
  uploadSessionId: string;
};

export async function prepareValidatedVideoUpload(
  candidate: VideoUploadCandidate
): Promise<PreparedVideoUpload> {
  const { session, supabase } = await requireWritableMediaSession();
  validateCandidate(candidate);

  const safeFileName = sanitizeVideoFileName(candidate.fileName);
  const { data, error } = await supabase.rpc("create_media_video_upload_intent", {
    p_expected_mime_type: candidate.mimeType,
    p_expected_size_bytes: candidate.fileSizeBytes,
    p_idempotency_key: candidate.idempotencyKey,
    p_original_file_name: safeFileName,
    p_tenant_id: session.tenantId,
    p_title: candidate.title.trim()
  });
  const intent = Array.isArray(data) ? data[0] : null;
  if (
    error || !intent || typeof intent.upload_session_id !== "string"
    || typeof intent.storage_path !== "string" || typeof intent.expires_at !== "string"
  ) {
    console.error("Video-uploadintent maken mislukt", error);
    throw new MediaUploadError(
      error?.code === "53100"
        ? "De opslaglimiet van deze vereniging is bereikt. Archiveer ongebruikte media of verhoog de limiet voordat je opnieuw uploadt."
        : error?.code === "54000"
          ? "Er staan al vijf video-uploads open. Hervat of annuleer een bestaande upload voordat je een nieuwe start."
        : "De beveiligde uploadsessie kon niet worden gemaakt. Er is niets opgeslagen; probeer opnieuw."
    );
  }

  return {
    bucket: "tenant-media",
    expiresAt: intent.expires_at,
    path: intent.storage_path,
    resumed: intent.resumed === true,
    title: candidate.title.trim(),
    uploadSessionId: intent.upload_session_id
  };
}

export async function finalizeValidatedVideoUpload(uploadSessionId: string) {
  const { supabase } = await requireWritableMediaSession();
  if (!isUuid(uploadSessionId)) {
    throw new MediaUploadError(
      "De uploadsessie is ongeldig. De video is niet in verwerking gezet; start de upload opnieuw."
    );
  }

  const { data, error } = await supabase.rpc("finalize_media_video_upload_v2", {
    p_upload_session_id: uploadSessionId
  });
  if (error || !Array.isArray(data) || data.length !== 1) {
    console.error("Video-upload finaliseren mislukt", error);
    if (error?.code === "22023") {
      const { error: quarantineError } = await supabase.rpc(
        "quarantine_media_video_upload",
        {
          p_reason: "storage_metadata_mismatch",
          p_upload_session_id: uploadSessionId
        }
      );
      if (quarantineError) console.error("Afwijkende video quarantaine mislukt", quarantineError);
      throw new MediaUploadError(
        "De opgeslagen video wijkt af van de vooraf gecontroleerde grootte of het MIME-type en is in quarantaine geplaatst. Lever het bronbestand opnieuw aan."
      );
    }
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
  const { data: cancelled, error: cancellationError } = await supabase.rpc(
    "cancel_media_video_upload",
    { p_upload_session_id: uploadSessionId }
  );
  return {
    blocked: !cancellationError && cancelled === true,
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
    !isUuid(candidate.idempotencyKey) ||
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
