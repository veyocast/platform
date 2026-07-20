"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createPlaylist(formData: FormData) {
  const { session, supabase } = await requirePlaylistWriter();
  const name = playlistName(formData);
  const description = String(formData.get("description") ?? "").trim();

  if (description.length > 500) fail(null, "De beschrijving mag maximaal 500 tekens bevatten.");

  const { data, error } = await supabase.from("playlists").insert({
    created_by: session.userId,
    description: description || null,
    name,
    status: "draft",
    tenant_id: session.tenantId
  }).select("id").single();

  if (error || !data) {
    console.error("Playlist maken mislukt", error);
    fail(null, "De playlist kon niet worden gemaakt. Er is niets opgeslagen; controleer je rechten en probeer opnieuw.");
  }

  complete(data.id, "De conceptplaylist is gemaakt. Voeg nu gereedstaande media toe.");
}

export async function updatePlaylistDetails(formData: FormData) {
  const { session, supabase } = await requirePlaylistWriter();
  const playlistId = idValue(formData, "playlistId");
  const name = playlistName(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) fail(playlistId, "De beschrijving mag maximaal 500 tekens bevatten.");

  const { error } = await supabase.from("playlists").update({
    description: description || null,
    name,
    status: "draft",
    updated_at: new Date().toISOString()
  }).eq("id", playlistId).eq("tenant_id", session.tenantId);

  if (error) fail(playlistId, "De playlistgegevens konden niet worden opgeslagen. Het bestaande concept is ongewijzigd; probeer opnieuw.");
  complete(playlistId, "De playlistgegevens zijn opgeslagen als concept.");
}

export async function addPlaylistItem(formData: FormData) {
  const { session, supabase, tenantId } = await requirePlaylistWriter();
  const playlistId = idValue(formData, "playlistId");
  const mediaAssetId = idValue(formData, "mediaAssetId");

  const [playlistResult, assetResult, settingsResult, orderResult] = await Promise.all([
    supabase.from("playlists").select("id").eq("id", playlistId).eq("tenant_id", session.tenantId).neq("status", "archived").maybeSingle(),
    supabase.from("media_assets").select("id, kind").eq("id", mediaAssetId).eq("tenant_id", session.tenantId).eq("status", "ready").is("deleted_at", null).maybeSingle(),
    supabase.from("tenant_settings").select("default_image_duration_seconds, default_fit_mode, default_video_muted").eq("tenant_id", session.tenantId).maybeSingle(),
    supabase.from("playlist_items").select("sort_order").eq("playlist_id", playlistId).eq("tenant_id", session.tenantId).order("sort_order", { ascending: false }).limit(1)
  ]);

  if (playlistResult.error || !playlistResult.data) fail(playlistId, "Deze playlist is niet beschikbaar om te bewerken.");
  if (assetResult.error || !assetResult.data) fail(playlistId, "De gekozen media is niet gereed of hoort niet bij deze vereniging.");
  if (settingsResult.error || orderResult.error) fail(playlistId, "De itemstandaarden konden niet veilig worden geladen; er is niets toegevoegd.");

  const settings = settingsResult.data;
  const duration = assetResult.data.kind === "video" ? 10 : settings?.default_image_duration_seconds ?? 10;
  const sortOrder = (orderResult.data?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("playlist_items").insert({
    created_by: session.userId,
    duration_seconds: duration,
    fit_mode: settings?.default_fit_mode ?? "contain",
    media_asset_id: mediaAssetId,
    muted: settings?.default_video_muted ?? true,
    playlist_id: playlistId,
    sort_order: sortOrder,
    tenant_id: session.tenantId
  });

  if (error) fail(playlistId, "Het media-item kon niet worden toegevoegd. Het concept is ongewijzigd; probeer opnieuw.");
  await markDraft(supabase, tenantId, playlistId);
  complete(playlistId, "Het media-item is aan het concept toegevoegd.");
}

export async function updatePlaylistItem(formData: FormData) {
  const { session, supabase, tenantId } = await requirePlaylistWriter();
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const duration = Number.parseInt(String(formData.get("duration") ?? ""), 10);
  const fitMode = String(formData.get("fitMode") ?? "");
  const muted = formData.get("muted") === "on";

  if (!Number.isInteger(duration) || duration < 5 || duration > 3600) fail(playlistId, "De itemduur moet tussen 5 en 3600 seconden liggen.");
  if (!['contain', 'cover'].includes(fitMode)) fail(playlistId, "Kies volledig in beeld of schermvullend.");

  const { error } = await supabase.from("playlist_items").update({
    duration_seconds: duration,
    fit_mode: fitMode,
    muted,
    updated_at: new Date().toISOString()
  }).eq("id", itemId).eq("playlist_id", playlistId).eq("tenant_id", session.tenantId);

  if (error) fail(playlistId, "De iteminstellingen konden niet worden opgeslagen. De vorige waarden blijven actief.");
  await markDraft(supabase, tenantId, playlistId);
  complete(playlistId, "De iteminstellingen zijn opgeslagen.");
}

export async function movePlaylistItem(formData: FormData) {
  const { supabase } = await requirePlaylistWriter();
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const direction = String(formData.get("direction") ?? "") === "up" ? -1 : 1;
  const { error } = await supabase.rpc("reorder_playlist_item", {
    p_direction: direction,
    p_item_id: itemId
  });
  if (error) fail(playlistId, "De volgorde kon niet veilig worden gewijzigd. Het concept blijft in de vorige volgorde staan.");
  complete(playlistId, direction === -1 ? "Het item is omhoog verplaatst." : "Het item is omlaag verplaatst.");
}

export async function removePlaylistItem(formData: FormData) {
  const { session, supabase, tenantId } = await requirePlaylistWriter();
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const { error } = await supabase.from("playlist_items").delete().eq("id", itemId).eq("playlist_id", playlistId).eq("tenant_id", session.tenantId);
  if (error) fail(playlistId, "Het item kon niet worden verwijderd. Het concept is ongewijzigd.");
  await markDraft(supabase, tenantId, playlistId);
  complete(playlistId, "Het item is uit het concept verwijderd.");
}

export async function archivePlaylist(formData: FormData) {
  const { session, supabase } = await requirePlaylistWriter(
    "tenant.playlist.archive"
  );
  const playlistId = idValue(formData, "playlistId");
  const { count, error: assignmentError } = await supabase.from("screens").select("id", { count: "exact", head: true }).eq("tenant_id", session.tenantId).eq("assigned_playlist_id", playlistId).neq("status", "disabled");
  if (assignmentError) fail(playlistId, "De schermtoewijzingen konden niet worden gecontroleerd. Er is niets gearchiveerd.");
  if ((count ?? 0) > 0) fail(playlistId, "Deze playlist is nog aan een actief scherm toegewezen. Publiceer daar eerst een andere playlist; de huidige release blijft spelen.");
  const { error } = await supabase.from("playlists").update({
    archived_at: new Date().toISOString(),
    status: "archived",
    updated_at: new Date().toISOString()
  }).eq("id", playlistId).eq("tenant_id", session.tenantId);
  if (error) fail(playlistId, "De playlist kon niet worden gearchiveerd. Bestaande releases blijven ongewijzigd.");
  revalidatePath("/dashboard/playlists");
  redirect("/dashboard/playlists?succes=De+playlist+is+gearchiveerd.+Bestaande+releases+blijven+onveranderlijk.");
}

export async function publishPlaylist(formData: FormData) {
  const { supabase } = await requirePlaylistWriter(
    "tenant.playlist.publish",
    "publish"
  );
  const playlistId = idValue(formData, "playlistId");
  const screenIds = formData.getAll("screenIds").map(String).filter(Boolean);
  const releaseNotes = String(formData.get("releaseNotes") ?? "").trim();
  if (screenIds.length === 0) fail(playlistId, "Kies minimaal één doelscherm. Er is geen release gemaakt.");
  if (releaseNotes.length > 500) fail(playlistId, "De releasenotitie mag maximaal 500 tekens bevatten.");

  const { error } = await supabase.rpc("publish_playlist_to_screens", {
    p_playlist_id: playlistId,
    p_release_notes: releaseNotes || null,
    p_screen_ids: screenIds
  });
  if (error) {
    console.error("Playlist publiceren mislukt", error);
    fail(playlistId, publishFailureMessage(error.code));
  }
  revalidatePath("/dashboard/playlists");
  revalidatePath("/dashboard/screens");
  revalidatePath("/dashboard/pilot");
  redirect(`/dashboard/playlists?playlist=${playlistId}&succes=${encodeURIComponent("De immutable release is gemaakt en als gewenste release aan de gekozen schermen toegewezen.")}`);
}

async function requirePlaylistWriter(
  capability:
    | "tenant.playlist.archive"
    | "tenant.playlist.publish"
    | "tenant.playlist.write" = "tenant.playlist.write",
  operation: "mutate" | "publish" = "mutate"
) {
  const session = await requireTenantCapability(capability, operation);
  const supabase = await createControlSupabaseClient();
  const tenantId = session.tenantId;
  if (!session.isLive || !tenantId || !supabase) fail(null, "Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  return { session, supabase, tenantId };
}

async function markDraft(supabase: Awaited<ReturnType<typeof createControlSupabaseClient>>, tenantId: string, playlistId: string) {
  if (!supabase) return;
  await supabase.from("playlists").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", playlistId).eq("tenant_id", tenantId);
}

function playlistName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) fail(null, "Gebruik een playlistnaam van 2 tot en met 120 tekens.");
  return name;
}

function idValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) fail(null, "De gekozen resource is ongeldig. Er is niets gewijzigd; laad de pagina opnieuw.");
  return value;
}

function publishFailureMessage(code: string | undefined) {
  if (code === "23514") return "Publiceren is geblokkeerd. Controleer of ieder item gereed is, een player-variant heeft en minimaal één scherm is geselecteerd.";
  if (code === "42501") return "Je mag deze playlist niet publiceren. Er is niets toegewezen; vraag een tenantbeheerder om je rol te controleren.";
  return "De release kon niet atomair worden gemaakt. De huidige release blijft spelen; controleer de media en probeer opnieuw.";
}

function fail(playlistId: string | null, message: string): never {
  const selected = playlistId ? `playlist=${encodeURIComponent(playlistId)}&` : "";
  redirect(`/dashboard/playlists?${selected}fout=${encodeURIComponent(message)}`);
}

function complete(playlistId: string, message: string): never {
  revalidatePath("/dashboard/playlists");
  redirect(`/dashboard/playlists?playlist=${playlistId}&succes=${encodeURIComponent(message)}`);
}
