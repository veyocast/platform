"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  playlistConflictSchema,
  type PlaylistDraftOperation
} from "@veyocast/contracts";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadDraftPreflight } from "../releases/data";
import { loadPlaylistStudio } from "./data";
import { getReadinessCopy } from "./readiness-copy";

type MutationRow = { actual_revision: number; outcome: "applied" | "conflict" };
type PublishRow = { actual_revision: number; outcome: "conflict" | "published"; release_id: string | null };

export async function createPlaylist(formData: FormData) {
  const { session, supabase } = await requirePlaylistWriter();
  const name = playlistName(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) failList("De beschrijving mag maximaal 500 tekens bevatten.");

  const { data, error } = await supabase.from("playlists").insert({
    created_by: session.userId,
    description: description || null,
    name,
    status: "draft",
    tenant_id: session.tenantId,
    updated_by: session.userId
  }).select("id").single();

  if (error || !data) {
    console.error("Playlist maken mislukt", error);
    failList("De playlist kon niet worden gemaakt. Er is niets opgeslagen; controleer je rechten en probeer opnieuw.");
  }
  redirect(`/dashboard/playlists/${data.id}?succes=${encodeURIComponent("De conceptplaylist is gemaakt. Voeg nu gereedstaande media toe.")}`);
}

export async function duplicatePlaylist(formData: FormData) {
  const { supabase } = await requirePlaylistWriter();
  const sourcePlaylistId = idValue(formData, "sourcePlaylistId");
  const requestedName = String(formData.get("name") ?? "").trim();
  if (requestedName && (requestedName.length < 2 || requestedName.length > 120)) {
    failList("Gebruik een naam van 2 tot en met 120 tekens voor de kopie.");
  }

  const { data, error } = await supabase.rpc("duplicate_playlist_draft_v1", {
    p_name: requestedName || null,
    p_source_playlist_id: sourcePlaylistId
  });
  if (error || typeof data !== "string") {
    console.error("Playlist dupliceren mislukt", error);
    failList(duplicateFailureMessage(error?.code));
  }

  revalidatePath("/dashboard/playlists");
  redirect(`/dashboard/playlists/${data}?succes=${encodeURIComponent("De playlist is als nieuw concept gedupliceerd. Releasehistorie en schermtoewijzingen zijn niet overgenomen.")}`);
}

export async function updatePlaylistDetails(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const name = playlistName(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) fail(playlistId, "De beschrijving mag maximaal 500 tekens bevatten.");
  await mutate(formData, playlistId, "update_details", { description, name }, "De playlistgegevens zijn opgeslagen als concept.");
}

export async function addPlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const mediaAssetId = idValue(formData, "mediaAssetId");
  await mutate(formData, playlistId, "add_item", { mediaAssetId }, "Het media-item is aan het concept toegevoegd.");
}

export async function updatePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const durationSeconds = Number.parseInt(String(formData.get("duration") ?? ""), 10);
  const fitMode = String(formData.get("fitMode") ?? "");
  const muted = formData.get("muted") === "on";
  if (displayName.length < 2 || displayName.length > 120) fail(playlistId, "Gebruik een medianaam van 2 tot en met 120 tekens.");
  if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 3600) fail(playlistId, "De itemduur moet tussen 5 en 3600 seconden liggen.");
  if (fitMode !== "contain" && fitMode !== "cover") fail(playlistId, "Kies Volledig in beeld of Schermvullend.");
  await mutate(formData, playlistId, "update_item", { displayName, durationSeconds, fitMode, itemId, muted }, "De iteminstellingen zijn opgeslagen.");
}

export async function movePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const direction = String(formData.get("direction") ?? "");
  const targetPositionValue = String(formData.get("targetPosition") ?? "");
  const targetPosition = targetPositionValue ? Number.parseInt(targetPositionValue, 10) : null;
  if (targetPosition === null && !["up", "down", "start", "end"].includes(direction)) fail(playlistId, "De gekozen verplaatsing is ongeldig.");
  if (targetPosition !== null && (!Number.isInteger(targetPosition) || targetPosition < 0)) fail(playlistId, "De gekozen doelpositie is ongeldig.");
  const messages: Record<string, string> = {
    down: "Het item is omlaag verplaatst.",
    end: "Het item staat nu onderaan.",
    start: "Het item staat nu bovenaan.",
    up: "Het item is omhoog verplaatst."
  };
  const payload: Record<string, boolean | number | string> = targetPosition === null
    ? { direction, itemId }
    : { itemId, targetPosition };
  await mutate(formData, playlistId, "move_item", payload, messages[direction] ?? "De nieuwe volgorde is opgeslagen.");
}

export async function removePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  await mutate(formData, playlistId, "remove_item", { itemId }, "Het item is uit het concept verwijderd.");
}

export async function archivePlaylist(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const result = await runMutation(formData, playlistId, "archive", {});
  if (result.outcome === "conflict") conflict(playlistId, expectedRevision(formData), result.actual_revision, "archive");
  revalidatePlaylistPaths(playlistId);
  redirect(`/dashboard/playlists?succes=${encodeURIComponent("De playlist is gearchiveerd. Bestaande releases blijven onveranderlijk.")}`);
}

export async function publishPlaylistGuided(formData: FormData) {
  const { session, supabase } = await requirePlaylistWriter("tenant.playlist.publish", "publish");
  const playlistId = idValue(formData, "playlistId");
  const revision = expectedRevision(formData);
  const screenIds = [...new Set(formData.getAll("screenIds").map(String).filter(Boolean))];
  const releaseNotes = String(formData.get("releaseNotes") ?? "").trim();
  if (!screenIds.length) failPublish(playlistId, "Kies minimaal één doelscherm. Er is geen release gemaakt.");
  if (releaseNotes.length > 500) failPublish(playlistId, "De releasenotitie mag maximaal 500 tekens bevatten.");
  if (formData.get("confirmPublish") !== "on") failPublish(playlistId, "Bevestig expliciet dat je een nieuwe immutable release maakt.");

  const studio = await loadPlaylistStudio(session.tenantId, playlistId, false);
  if (!studio.playlist || !studio.readiness) failPublish(playlistId, "Het concept kon niet opnieuw worden gecontroleerd. Er is geen release gemaakt.");
  if (studio.playlist.revision !== revision) conflict(playlistId, revision, studio.playlist.revision, "publish");
  if (!studio.readiness.canPublish) {
    const blocker = studio.readiness.reasons[0];
    const message = blocker ? getReadinessCopy(blocker) : null;
    failPublish(playlistId, message ? `${message.label}. ${message.detail} ${message.recovery}` : "De playlist is nog niet klaar voor publicatie.");
  }
  const targetItems = studio.items.flatMap((item) => item.asset?.variant
    ? [{ checksumSha256: item.asset.variant.checksumSha256, fileSizeBytes: item.asset.variant.fileSizeBytes }]
    : []);
  const preflight = await loadDraftPreflight(session.tenantId, targetItems);
  if (preflight.error) failPublish(playlistId, `${preflight.error} Er is geen release gemaakt.`);
  const targets = preflight.screenStates.filter((state) => screenIds.includes(state.screen.id));
  if (targets.length !== screenIds.length) failPublish(playlistId, "Een of meer doelschermen zijn niet beschikbaar binnen deze vereniging.");
  if (targets.some((state) => state.preflight.status === "blocked")) {
    failPublish(playlistId, "Publiceren is geblokkeerd: minimaal één doelscherm is uitgeschakeld, incompatibel of heeft aantoonbaar onvoldoende opslag.");
  }
  if (targets.some((state) => state.preflight.status === "warning" || state.preflight.status === "unknown") && formData.get("confirmRisk") !== "on") {
    failPublish(playlistId, "Bevestig bewust de waarschuwingen en onbekende telemetry voordat je publiceert.");
  }

  const { data, error } = await supabase.rpc("publish_playlist_to_screens_v2", {
    p_expected_revision: revision,
    p_playlist_id: playlistId,
    p_release_notes: releaseNotes || null,
    p_screen_ids: screenIds
  });
  if (error) {
    console.error("Begeleide playlistpublicatie mislukt", error);
    failPublish(playlistId, publishFailureMessage(error.code));
  }
  const result = (data?.[0] ?? null) as PublishRow | null;
  if (!result) failPublish(playlistId, "De publicatie gaf geen bevestiging. De huidige release blijft spelen; probeer opnieuw.");
  if (result.outcome === "conflict") conflict(playlistId, revision, Number(result.actual_revision), "publish");
  if (!result.release_id) failPublish(playlistId, "De release-ID ontbreekt in de publicatiebevestiging. Controleer Release Center voordat je opnieuw probeert.");

  revalidatePlaylistPaths(playlistId);
  revalidatePath("/dashboard/releases");
  revalidatePath(`/dashboard/releases/${result.release_id}`);
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/releases/${result.release_id}?succes=${encodeURIComponent("De immutable release is gepubliceerd. Volg hieronder desired, download, verificatie en activatie per scherm.")}`);
}

async function mutate(
  formData: FormData,
  playlistId: string,
  operation: PlaylistDraftOperation,
  payload: Record<string, boolean | number | string>,
  success: string
) {
  const revision = expectedRevision(formData);
  const result = await runMutation(formData, playlistId, operation, payload);
  if (result.outcome === "conflict") conflict(playlistId, revision, Number(result.actual_revision), operation);
  revalidatePlaylistPaths(playlistId);
  redirect(`/dashboard/playlists/${playlistId}?succes=${encodeURIComponent(success)}`);
}

async function runMutation(
  formData: FormData,
  playlistId: string,
  operation: PlaylistDraftOperation,
  payload: Record<string, boolean | number | string>
) {
  const { supabase } = await requirePlaylistWriter(operation === "archive" ? "tenant.playlist.archive" : "tenant.playlist.write");
  const { data, error } = await supabase.rpc("mutate_playlist_draft_v1", {
    p_expected_revision: expectedRevision(formData),
    p_operation: operation,
    p_payload: payload,
    p_playlist_id: playlistId
  });
  if (error) {
    console.error(`Playlistmutatie ${operation} mislukt`, error);
    fail(playlistId, mutationFailureMessage(error.code, operation));
  }
  const result = (data?.[0] ?? null) as MutationRow | null;
  if (!result) fail(playlistId, "De wijziging gaf geen bevestiging. Het concept is mogelijk niet gewijzigd; laad de pagina opnieuw.");
  return result;
}

async function requirePlaylistWriter(
  capability: "tenant.playlist.archive" | "tenant.playlist.publish" | "tenant.playlist.write" = "tenant.playlist.write",
  operation: "mutate" | "publish" = "mutate"
) {
  const session = await requireTenantCapability(capability, operation);
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) failList("Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

function expectedRevision(formData: FormData) {
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);
  if (!Number.isInteger(revision) || revision < 0) failList("De conceptversie ontbreekt. Laad Playlist Studio opnieuw voordat je wijzigt.");
  return revision;
}

function playlistName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) failList("Gebruik een playlistnaam van 2 tot en met 120 tekens.");
  return name;
}

function idValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) failList("De gekozen resource is ongeldig. Er is niets gewijzigd; laad de pagina opnieuw.");
  return value;
}

function conflict(playlistId: string, expected: number, actual: number, operation: string): never {
  const conflictState = playlistConflictSchema.parse({
    actualRevision: actual,
    code: "PLAYLIST_REVISION_CONFLICT",
    expectedRevision: expected,
    playlistId,
    recovery: "compare"
  });
  redirect(`/dashboard/playlists/${conflictState.playlistId}?conflict=1&expected=${conflictState.expectedRevision}&actual=${conflictState.actualRevision}&operation=${encodeURIComponent(operation)}#playlist-conflict`);
}

function publishFailureMessage(code: string | undefined) {
  if (code === "23514") return "Publiceren is geblokkeerd. Controleer iedere readinessblokkade en probeer daarna opnieuw.";
  if (code === "42501") return "Je mag deze playlist niet publiceren. Er is niets toegewezen; vraag een beheerder om je rol te controleren.";
  return "De release kon niet atomair worden gemaakt. De huidige release blijft spelen; controleer de media en probeer opnieuw.";
}

function mutationFailureMessage(code: string | undefined, operation: string) {
  if (code === "P0002") return "De playlist of het item bestaat niet meer. Laad de nieuwste versie van Playlist Studio.";
  if (code === "42501") return "Je mag dit concept niet wijzigen. Er is niets opgeslagen; vraag een beheerder om je rol te controleren.";
  if (operation === "archive") return "De playlist kan niet worden gearchiveerd zolang deze aan een actief scherm is toegewezen.";
  return "De wijziging voldeed niet aan de playlistregels. Het bestaande concept is ongewijzigd; controleer de invoer.";
}

function duplicateFailureMessage(code: string | undefined) {
  if (code === "P0002") {
    return "De bronplaylist bestaat niet meer. Er is geen kopie gemaakt; vernieuw de lijst.";
  }
  if (code === "42501") {
    return "Je mag deze playlist niet dupliceren. Er is geen kopie gemaakt; controleer je rol en actieve vereniging.";
  }
  return "De playlist kon niet veilig worden gedupliceerd. Er is geen gedeeltelijke kopie opgeslagen; probeer opnieuw.";
}

function revalidatePlaylistPaths(playlistId: string) {
  revalidatePath("/dashboard/playlists");
  revalidatePath(`/dashboard/playlists/${playlistId}`);
}

function fail(playlistId: string, message: string): never {
  redirect(`/dashboard/playlists/${playlistId}?fout=${encodeURIComponent(message)}`);
}

function failPublish(playlistId: string, message: string): never {
  redirect(`/dashboard/playlists/${playlistId}/publish?fout=${encodeURIComponent(message)}`);
}

function failList(message: string): never {
  redirect(`/dashboard/playlists?fout=${encodeURIComponent(message)}`);
}
