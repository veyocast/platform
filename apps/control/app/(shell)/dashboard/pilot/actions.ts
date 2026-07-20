"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import {
  MediaUploadError,
  uploadValidatedImage
} from "../../../../lib/media/validated-image-upload";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function ingestPilotImage(formData: FormData) {
  await requireTenantCapability("tenant.media.write");
  try {
    await uploadValidatedImage(formData);
    complete("Afbeelding is geverifieerd en gereed voor een playlist.");
  } catch (error) {
    if (error instanceof MediaUploadError) {
      fail(error.message);
    }

    throw error;
  }
}

export async function createPilotPlaylist(formData: FormData) {
  const { session, supabase } = await requireLivePilotContext(
    "tenant.playlist.write"
  );
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
  const { supabase } = await requireLivePilotContext(
    "tenant.playlist.publish",
    "publish"
  );
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
  const { session, supabase } = await requireLivePilotContext(
    "tenant.screen.manage",
    "pair"
  );
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

async function requireLivePilotContext(
  capability:
    | "tenant.playlist.publish"
    | "tenant.playlist.write"
    | "tenant.screen.manage",
  operation: "mutate" | "pair" | "publish" = "mutate"
) {
  const session = await requireTenantCapability(capability, operation);
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Start lokale Supabase en log in om de live pilotflow te gebruiken.");
  }

  return { session, supabase };
}

function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function fail(message: string): never {
  redirect(`/dashboard/pilot?fout=${encodeURIComponent(message)}`);
}

function complete(message: string): never {
  revalidatePath("/dashboard/pilot");
  redirect(`/dashboard/pilot?succes=${encodeURIComponent(message)}`);
}
