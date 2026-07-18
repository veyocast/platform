"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlAdminClient } from "../../../../lib/supabase/admin";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maxPilotImageBytes = 20 * 1024 * 1024;

export async function ingestPilotImage(formData: FormData) {
  const { session, supabase } = await requireLivePilotContext();
  const candidate = formData.get("media");
  const title = String(formData.get("title") ?? "").trim();

  if (!(candidate instanceof File) || candidate.size === 0) {
    fail("Kies een JPEG-, PNG- of WebP-afbeelding met inhoud.");
  }

  if (!title || title.length < 2) {
    fail("Geef de media een titel van minimaal twee tekens.");
  }

  if (candidate.size > maxPilotImageBytes) {
    fail("De afbeelding is groter dan de pilotlimiet van 20 MB.");
  }

  if (!allowedImageMimeTypes.includes(candidate.type as typeof allowedImageMimeTypes[number])) {
    fail("Dit bestandstype wordt niet ondersteund. Gebruik JPEG, PNG of WebP.");
  }

  const bytes = Buffer.from(await candidate.arrayBuffer());
  const detectedMimeType = detectImageMime(bytes);

  if (!detectedMimeType || detectedMimeType !== candidate.type) {
    fail("Bestandsinhoud en MIME-type komen niet overeen. Kies een geldige afbeelding.");
  }

  const assetId = randomUUID();
  const safeFileName = sanitizeFileName(candidate.name, detectedMimeType);
  const storagePath =
    `tenants/${session.tenantId}/assets/${assetId}/original/${safeFileName}`;
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: assetError } = await supabase.from("media_assets").insert({
    created_by: session.userId,
    file_size_bytes: bytes.byteLength,
    id: assetId,
    kind: "image",
    mime_type: detectedMimeType,
    original_file_name: safeFileName,
    status: "uploading",
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: session.tenantId,
    title
  });

  if (assetError) {
    fail(`De mediaregistratie is mislukt: ${assetError.message}`);
  }

  const admin = createControlAdminClient();
  const { error: storageError } = await admin.storage
    .from("tenant-media")
    .upload(storagePath, bytes, {
      cacheControl: "31536000",
      contentType: detectedMimeType,
      upsert: false
    });

  if (storageError) {
    await admin
      .from("media_assets")
      .update({
        status: "validation_failed",
        validation_error: "storage_upload_failed"
      })
      .eq("id", assetId);
    fail(`Uploaden is mislukt: ${storageError.message}`);
  }

  const { error: variantError } = await admin.from("media_variants").insert({
    asset_id: assetId,
    checksum_sha256: checksumSha256,
    file_size_bytes: bytes.byteLength,
    mime_type: detectedMimeType,
    storage_bucket: "tenant-media",
    storage_path: storagePath,
    tenant_id: session.tenantId,
    variant_type: "original"
  });

  if (variantError) {
    await admin.storage.from("tenant-media").remove([storagePath]);
    await admin
      .from("media_assets")
      .update({
        status: "validation_failed",
        validation_error: "variant_registration_failed"
      })
      .eq("id", assetId);
    fail(`De player-variant kon niet worden geregistreerd: ${variantError.message}`);
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
    fail(`De media kon niet gereed worden gemeld: ${readyError.message}`);
  }

  complete("Afbeelding is geverifieerd en gereed voor een playlist.");
}

export async function createPilotPlaylist(formData: FormData) {
  const { session, supabase } = await requireLivePilotContext();
  const mediaAssetId = String(formData.get("mediaAssetId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!mediaAssetId || name.length < 2) {
    fail("Kies gereedstaande media en geef de playlist een duidelijke naam.");
  }

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id")
    .eq("id", mediaAssetId)
    .eq("tenant_id", session.tenantId)
    .eq("status", "ready")
    .maybeSingle();

  if (assetError || !asset) {
    fail("De gekozen media is niet gereed of hoort niet bij deze vereniging.");
  }

  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .insert({
      created_by: session.userId,
      name,
      status: "draft",
      tenant_id: session.tenantId
    })
    .select("id")
    .single();

  if (playlistError || !playlist) {
    fail(`De playlist kon niet worden gemaakt: ${playlistError?.message ?? "onbekende fout"}`);
  }

  const { error: itemError } = await supabase.from("playlist_items").insert({
    created_by: session.userId,
    duration_seconds: 10,
    fit_mode: "contain",
    media_asset_id: mediaAssetId,
    muted: true,
    playlist_id: playlist.id,
    sort_order: 0,
    tenant_id: session.tenantId
  });

  if (itemError) {
    await supabase.from("playlists").delete().eq("id", playlist.id);
    fail(`Het playlistitem kon niet worden toegevoegd: ${itemError.message}`);
  }

  complete("Conceptplaylist is gemaakt met één geverifieerd item.");
}

export async function publishPilotPlaylist(formData: FormData) {
  const { supabase } = await requireLivePilotContext();
  const playlistId = String(formData.get("playlistId") ?? "");
  const screenId = String(formData.get("screenId") ?? "");

  if (!playlistId || !screenId) {
    fail("Kies een conceptplaylist en een doelscherm.");
  }

  const { error } = await supabase.rpc("publish_playlist_to_screens", {
    p_playlist_id: playlistId,
    p_release_notes: "Lokale pilotpublicatie",
    p_screen_ids: [screenId]
  });

  if (error) {
    fail(`Publiceren is mislukt: ${error.message}`);
  }

  complete("Immutable release is gemaakt en als gewenste release toegewezen.");
}

export async function claimPilotPairing(formData: FormData) {
  const { session, supabase } = await requireLivePilotContext();
  const screenId = String(formData.get("screenId") ?? "");
  const pairingCode = normalizePairingCode(String(formData.get("pairingCode") ?? ""));

  if (!screenId || pairingCode.length !== 6) {
    fail("Voer de zes tekens van de Player in en kies een scherm.");
  }

  const codeHash = createHash("sha256").update(pairingCode).digest("hex");
  const { error } = await supabase.rpc("claim_pairing_session_v2", {
    p_code_hash: codeHash,
    p_device_name: "Chrome pilotplayer",
    p_screen_id: screenId,
    p_tenant_id: session.tenantId
  });

  if (error) {
    fail(`Koppelen is mislukt: ${error.message}`);
  }

  complete("Player is gekoppeld. Het device-token is alleen op de Player bewaard.");
}

async function requireLivePilotContext() {
  const session = await requireControlSession();
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Start lokale Supabase en log in om de live pilotflow te gebruiken.");
  }

  const canWrite = session.roles.some((role) =>
    ["tenant_owner", "tenant_admin", "tenant_editor"].includes(role)
  );

  if (!canWrite) {
    fail("Voor deze stap zijn editor- of beheerrechten nodig.");
  }

  return { session, supabase };
}

function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
      .slice(0, 80) || "pilot-media";

  return `${baseName}.${extension}`;
}

function fail(message: string): never {
  redirect(`/dashboard/pilot?fout=${encodeURIComponent(message)}`);
}

function complete(message: string): never {
  revalidatePath("/dashboard/pilot");
  redirect(`/dashboard/pilot?succes=${encodeURIComponent(message)}`);
}
