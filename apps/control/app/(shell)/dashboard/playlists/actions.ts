"use server";

import { randomUUID } from "node:crypto";
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
type GuardedMutationResult = {
  actualRevision: number;
  outcome: "applied" | "conflict";
};
type GuardedPublishResult = {
  actualRevision: number;
  outcome: "conflict" | "published";
  releaseId?: string;
};
type PublisherDraftOperation =
  | "assign_item_section"
  | "create_section"
  | "delete_section"
  | "duplicate_item"
  | "move_item"
  | "move_section"
  | "replace_item"
  | "update_item_presentation"
  | "update_playlist_defaults"
  | "update_section";

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

export async function addDynamicPlaylistSlide(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const dynamicSlideId = idValue(formData, "dynamicSlideId");
  const durationSeconds = integerValue(formData, "durationSeconds");
  if (durationSeconds < 5 || durationSeconds > 3600) {
    fail(
      playlistId,
      "De berekende duur van de dynamische slide is ongeldig. Vernieuw de editor."
    );
  }
  const revision = expectedRevision(formData);
  const { supabase } = await requirePlaylistWriter();
  const { data, error } = await supabase.rpc(
    "add_dynamic_slide_to_playlist_v2",
    {
      p_duration_seconds: durationSeconds,
      p_dynamic_slide_id: dynamicSlideId,
      p_expected_revision: revision,
      p_idempotency_key: idempotencyValue(formData),
      p_playlist_id: playlistId
    }
  );
  if (error) {
    console.error("Dynamische slide aan playlist toevoegen mislukt", {
      code: error.code
    });
    fail(
      playlistId,
      error.code === "23514"
        ? "De dynamische slide heeft geen gereedstaande snapshot meer. Vernieuw de editor en probeer opnieuw."
        : "De dynamische slide kon niet aan het concept worden toegevoegd. Er is niets gewijzigd."
    );
  }
  const result = data as GuardedMutationResult | null;
  if (!result) {
    fail(
      playlistId,
      "De wijziging gaf geen bevestiging. Laad de playlisteditor opnieuw."
    );
  }
  if (result.outcome === "conflict") {
    conflict(
      playlistId,
      revision,
      Number(result.actualRevision),
      "add_dynamic_slide"
    );
  }
  revalidatePlaylistPaths(playlistId);
  redirect(
    `/dashboard/playlists/${playlistId}?succes=${encodeURIComponent(
      "De dynamische HTML/CSS-slide is aan het concept toegevoegd."
    )}`
  );
}

export async function addYouTubePlaylistSource(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const youtubeSourceId = idValue(formData, "youtubeSourceId");
  const durationSeconds = integerValue(formData, "durationSeconds");
  if (durationSeconds < 5 || durationSeconds > 3600) {
    fail(playlistId, "Kies een afspeelduur tussen 5 seconden en 60 minuten.");
  }
  const revision = expectedRevision(formData);
  const { supabase } = await requirePlaylistWriter();
  const { data, error } = await supabase.rpc("add_youtube_source_to_playlist_v1", {
    p_duration_seconds: durationSeconds,
    p_expected_revision: revision,
    p_idempotency_key: idempotencyValue(formData),
    p_playlist_id: playlistId,
    p_youtube_source_id: youtubeSourceId
  });
  if (error) {
    console.error("YouTube-bron aan playlist toevoegen mislukt", { code: error.code });
    fail(
      playlistId,
      error.code === "23514"
        ? "Deze YouTube-bron of lokale fallback is niet meer publiceerbaar. Valideer de bron opnieuw."
        : "De YouTube-bron kon niet worden toegevoegd. Er is niets gewijzigd."
    );
  }
  const result = data as GuardedMutationResult | null;
  if (!result) fail(playlistId, "De wijziging gaf geen bevestiging. Laad de playlisteditor opnieuw.");
  if (result.outcome === "conflict") {
    conflict(playlistId, revision, Number(result.actualRevision), "add_youtube_source");
  }
  revalidatePlaylistPaths(playlistId);
  redirect(`/dashboard/playlists/${playlistId}?succes=${encodeURIComponent("De online video is toegevoegd met een gecontroleerde lokale fallback.")}`);
}

export async function addEngagePlaylistCampaign(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const campaignId = idValue(formData, "campaignId");
  const fallbackMediaAssetId = idValue(formData, "fallbackMediaAssetId");
  const durationSeconds = integerValue(formData, "durationSeconds");
  const revision = expectedRevision(formData);
  const { supabase } = await requirePlaylistWriter();
  const { data, error } = await supabase.rpc("add_engage_campaign_to_playlist_v1", {
    p_campaign_id: campaignId,
    p_duration_seconds: durationSeconds,
    p_expected_revision: revision,
    p_fallback_media_asset_id: fallbackMediaAssetId,
    p_idempotency_key: idempotencyValue(formData),
    p_playlist_id: playlistId
  });
  if (error) {
    console.error("Engage-campagne aan playlist toevoegen mislukt", { code: error.code });
    fail(playlistId, error.code === "23514"
      ? "De campagne of lokale fallback is niet publiceerbaar. Kies actieve content en probeer opnieuw."
      : "De publieksactie kon niet worden toegevoegd. Er is niets gewijzigd.");
  }
  const result = data as GuardedMutationResult | null;
  if (!result) fail(playlistId, "De wijziging gaf geen bevestiging. Laad de playlisteditor opnieuw.");
  if (result.outcome === "conflict") {
    conflict(playlistId, revision, Number(result.actualRevision), "add_engage_campaign");
  }
  revalidatePlaylistPaths(playlistId);
  redirect(`/dashboard/playlists/${playlistId}?succes=${encodeURIComponent("De live publieksactie is toegevoegd; stemdata blijft runtime-data.")}`);
}

export async function updatePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const displayTitle = nullableText(formData, "displayTitle", 120);
  if (displayTitle && displayTitle.length < 2) {
    fail(playlistId, "Een aangepaste itemtitel bevat minimaal 2 tekens. Laat het veld leeg om de bibliotheektitel te gebruiken.");
  }
  const durationSeconds = Number.parseInt(String(formData.get("duration") ?? ""), 10);
  const fitMode = String(formData.get("fitMode") ?? "");
  const muted = formData.get("muted") === "on";
  const transition = String(formData.get("transition") ?? "");
  const cropFocusX = numericValue(formData, "cropFocusX");
  const cropFocusY = numericValue(formData, "cropFocusY");
  const backgroundColor = nullableText(formData, "backgroundColor", 7);
  const volumePercent = Number.parseInt(String(formData.get("volumePercent") ?? ""), 10);
  const trimStartSeconds = numericValue(formData, "trimStartSeconds");
  const trimEndSeconds = nullableNumber(formData, "trimEndSeconds");
  const visibleFrom = nullableIsoDate(formData, "visibleFrom");
  const visibleUntil = nullableIsoDate(formData, "visibleUntil");
  const enabled = formData.get("enabled") === "on";
  const accessibilityName = nullableText(formData, "accessibilityName", 160);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 3600) fail(playlistId, "De itemduur moet tussen 5 en 3600 seconden liggen.");
  if (fitMode !== "contain" && fitMode !== "cover") fail(playlistId, "Kies Volledig in beeld of Schermvullend.");
  if (!["cut", "crossfade", "wipe"].includes(transition)) fail(playlistId, "Kies een geldige overgang.");
  if (cropFocusX < 0 || cropFocusX > 1 || cropFocusY < 0 || cropFocusY > 1) fail(playlistId, "Het focuspunt moet binnen het beeld liggen.");
  if (backgroundColor && !/^#[0-9a-f]{6}$/i.test(backgroundColor)) fail(playlistId, "Gebruik een geldige hexkleur voor de achtergrond.");
  if (!Number.isInteger(volumePercent) || volumePercent < 0 || volumePercent > 100) fail(playlistId, "Volume moet tussen 0 en 100 procent liggen.");
  if (trimStartSeconds < 0 || (trimEndSeconds !== null && trimEndSeconds <= trimStartSeconds)) fail(playlistId, "Het gekozen begin- en eindpunt is niet geldig.");
  if (visibleFrom && visibleUntil && Date.parse(visibleUntil) <= Date.parse(visibleFrom)) fail(playlistId, "Het einde van de zichtbaarheid moet na het begin liggen.");
  await mutateGuarded(formData, playlistId, "update_item_presentation", {
    accessibilityName,
    backgroundColor,
    cropFocusX,
    cropFocusY,
    displayTitle,
    durationSeconds,
    enabled,
    fitMode,
    itemId,
    muted,
    transition,
    trimEndSeconds,
    trimStartSeconds,
    visibleFrom,
    visibleUntil,
    volumePercent
  }, "De iteminstellingen zijn opgeslagen.");
}

export async function updatePlaylistDefaults(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const defaultImageDurationSeconds = integerValue(
    formData,
    "defaultImageDurationSeconds"
  );
  const defaultTransition = transitionValue(formData, "defaultTransition");
  const defaultFitMode = fitModeValue(formData, "defaultFitMode");
  const defaultBackgroundColor = nullableText(
    formData,
    "defaultBackgroundColor",
    7
  );
  if (
    defaultImageDurationSeconds < 5 ||
    defaultImageDurationSeconds > 3600
  ) {
    fail(
      playlistId,
      "De standaardduur voor afbeeldingen moet tussen 5 en 3600 seconden liggen."
    );
  }
  if (
    defaultBackgroundColor &&
    !/^#[0-9a-f]{6}$/i.test(defaultBackgroundColor)
  ) {
    fail(playlistId, "Gebruik een geldige hexkleur voor de standaardachtergrond.");
  }
  await mutateGuarded(
    formData,
    playlistId,
    "update_playlist_defaults",
    {
      defaultBackgroundColor,
      defaultFitMode,
      defaultImageDurationSeconds,
      defaultTransition,
      defaultVideoMuted: formData.get("defaultVideoMuted") === "on",
      loopEnabled: formData.get("loopEnabled") === "on"
    },
    "De standaardinstellingen van het concept zijn opgeslagen."
  );
}

export async function createPlaylistSection(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const name = boundedText(formData, "name", 2, 120, playlistId);
  const defaultDurationSeconds = optionalDuration(formData, playlistId);
  const defaultTransition = optionalTransition(formData, playlistId);
  await mutateGuarded(
    formData,
    playlistId,
    "create_section",
    {
      defaultDurationSeconds,
      defaultTransition,
      enabled: true,
      name
    },
    `De sectie “${name}” is toegevoegd.`
  );
}

export async function updatePlaylistSection(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const sectionId = idValue(formData, "sectionId");
  const name = boundedText(formData, "name", 2, 120, playlistId);
  const defaultDurationSeconds = optionalDuration(formData, playlistId);
  const defaultTransition = optionalTransition(formData, playlistId);
  await mutateGuarded(
    formData,
    playlistId,
    "update_section",
    {
      defaultDurationSeconds,
      defaultTransition,
      enabled: formData.get("enabled") === "on",
      name,
      sectionId
    },
    `De sectie “${name}” is bijgewerkt.`
  );
}

export async function movePlaylistSection(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const sectionId = idValue(formData, "sectionId");
  const targetPosition = integerValue(formData, "targetPosition");
  if (targetPosition < 0) fail(playlistId, "De gekozen sectiepositie is ongeldig.");
  await mutateGuarded(
    formData,
    playlistId,
    "move_section",
    { sectionId, targetPosition },
    "De sectievolgorde is opgeslagen."
  );
}

export async function deletePlaylistSection(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const sectionId = idValue(formData, "sectionId");
  await mutateGuarded(
    formData,
    playlistId,
    "delete_section",
    { sectionId },
    "De sectie is verwijderd. De items staan nu zonder sectie in het concept."
  );
}

export async function assignPlaylistItemSection(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const sectionIdValue = String(formData.get("sectionId") ?? "");
  const sectionId = sectionIdValue ? idValue(formData, "sectionId") : null;
  await mutateGuarded(
    formData,
    playlistId,
    "assign_item_section",
    { itemId, sectionId },
    sectionId
      ? "Het item is aan de sectie gekoppeld."
      : "Het item staat nu zonder sectie."
  );
}

export async function duplicatePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  await mutateGuarded(
    formData,
    playlistId,
    "duplicate_item",
    { itemId },
    "Het playlistitem is direct na de bron gedupliceerd."
  );
}

export async function replacePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const mediaAssetId = idValue(formData, "mediaAssetId");
  await mutateGuarded(
    formData,
    playlistId,
    "replace_item",
    { itemId, mediaAssetId },
    "De media van deze plaatsing is vervangen. De iteminstellingen zijn behouden."
  );
}

export async function movePlaylistItem(formData: FormData) {
  const playlistId = idValue(formData, "playlistId");
  const itemId = idValue(formData, "itemId");
  const direction = String(formData.get("direction") ?? "");
  const targetPositionValue = String(formData.get("targetPosition") ?? "");
  let targetPosition = targetPositionValue ? Number.parseInt(targetPositionValue, 10) : null;
  if (targetPosition === null && !["up", "down", "start", "end"].includes(direction)) fail(playlistId, "De gekozen verplaatsing is ongeldig.");
  if (targetPosition !== null && (!Number.isInteger(targetPosition) || targetPosition < 0)) fail(playlistId, "De gekozen doelpositie is ongeldig.");
  const messages: Record<string, string> = {
    down: "Het item is omlaag verplaatst.",
    end: "Het item staat nu onderaan.",
    start: "Het item staat nu bovenaan.",
    up: "Het item is omhoog verplaatst."
  };
  if (targetPosition === null) {
    const { supabase } = await requirePlaylistWriter();
    const { data, error } = await supabase
      .from("playlist_items")
      .select("id")
      .eq("playlist_id", playlistId)
      .order("position_key")
      .order("id");
    if (error) fail(playlistId, "De actuele volgorde kon niet veilig worden geladen.");
    const index = (data ?? []).findIndex((item) => item.id === itemId);
    if (index < 0) fail(playlistId, "Het item bestaat niet meer. Laad de playlisteditor opnieuw.");
    targetPosition = direction === "start"
      ? 0
      : direction === "end"
        ? Math.max(0, (data?.length ?? 1) - 1)
        : direction === "up"
          ? Math.max(0, index - 1)
          : Math.min(Math.max(0, (data?.length ?? 1) - 1), index + 1);
  }
  await mutateGuarded(formData, playlistId, "move_item", { itemId, targetPosition }, messages[direction] ?? "De nieuwe volgorde is opgeslagen.");
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
  const enabledSections = new Set(
    studio.sections
      .filter((section) => section.enabled)
      .map((section) => section.id)
  );
  const targetItems = studio.items.flatMap((item) =>
    item.enabled &&
    (item.sectionId === null || enabledSections.has(item.sectionId)) &&
    item.asset?.variant
      ? [{
          checksumSha256: item.asset.variant.checksumSha256,
          fileSizeBytes: item.asset.variant.fileSizeBytes
        }]
      : []
  );
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

  const { data, error } = await supabase.rpc("publish_playlist_to_targets_v3", {
    p_expected_revision: revision,
    p_idempotency_key: idempotencyValue(formData),
    p_playlist_id: playlistId,
    p_release_notes: releaseNotes || null,
    p_screen_ids: screenIds
  });
  if (error) {
    console.error("Begeleide playlistpublicatie mislukt", error);
    failPublish(playlistId, publishFailureMessage(error.code));
  }
  const result = data as GuardedPublishResult | null;
  if (!result) failPublish(playlistId, "De publicatie gaf geen bevestiging. De huidige release blijft spelen; probeer opnieuw.");
  if (result.outcome === "conflict") conflict(playlistId, revision, Number(result.actualRevision), "publish");
  if (!result.releaseId) failPublish(playlistId, "De release-ID ontbreekt in de publicatiebevestiging. Controleer Release Center voordat je opnieuw probeert.");

  revalidatePlaylistPaths(playlistId);
  revalidatePath("/dashboard/releases");
  revalidatePath(`/dashboard/releases/${result.releaseId}`);
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/releases/${result.releaseId}?succes=${encodeURIComponent("De immutable release is gepubliceerd. Volg hieronder desired, download, verificatie en activatie per scherm.")}`);
}

async function mutateGuarded(
  formData: FormData,
  playlistId: string,
  operation: PublisherDraftOperation,
  payload: Record<string, boolean | number | string | null>,
  success: string
) {
  const revision = expectedRevision(formData);
  const { supabase } = await requirePlaylistWriter();
  const { data, error } = await supabase.rpc("mutate_playlist_draft_v2", {
    p_expected_revision: revision,
    p_idempotency_key: idempotencyValue(formData),
    p_operation: operation,
    p_payload: payload,
    p_playlist_id: playlistId
  });
  if (error) {
    console.error(`Playlistmutatie ${operation} mislukt`, error);
    fail(playlistId, mutationFailureMessage(error.code, operation));
  }
  const result = data as GuardedMutationResult | null;
  if (!result) fail(playlistId, "De wijziging gaf geen bevestiging. Laad de playlisteditor opnieuw.");
  if (result.outcome === "conflict") conflict(playlistId, revision, Number(result.actualRevision), operation);
  revalidatePlaylistPaths(playlistId);
  redirect(`/dashboard/playlists/${playlistId}?succes=${encodeURIComponent(success)}`);
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
  if (!Number.isInteger(revision) || revision < 0) failList("De conceptversie ontbreekt. Laad de playlisteditor opnieuw voordat je wijzigt.");
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

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : randomUUID();
}

function numericValue(formData: FormData, name: string) {
  const value = Number(String(formData.get(name) ?? ""));
  if (!Number.isFinite(value)) failList("Een numerieke iteminstelling is ongeldig.");
  return value;
}

function integerValue(formData: FormData, name: string) {
  const value = Number.parseInt(String(formData.get(name) ?? ""), 10);
  if (!Number.isInteger(value)) failList("Een gehele numerieke instelling is ongeldig.");
  return value;
}

function boundedText(
  formData: FormData,
  name: string,
  minLength: number,
  maxLength: number,
  playlistId: string
) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length < minLength || value.length > maxLength) {
    fail(
      playlistId,
      `Gebruik ${minLength} tot en met ${maxLength} tekens voor deze naam.`
    );
  }
  return value;
}

function fitModeValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (value !== "contain" && value !== "cover") {
    failList("Kies Volledig in beeld of Schermvullend.");
  }
  return value;
}

function transitionValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (value !== "cut" && value !== "crossfade" && value !== "wipe") {
    failList("Kies een geldige overgang.");
  }
  return value;
}

function optionalDuration(formData: FormData, playlistId: string) {
  const raw = String(formData.get("defaultDurationSeconds") ?? "").trim();
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 5 || value > 3600) {
    fail(
      playlistId,
      "De sectieduur moet leeg zijn of tussen 5 en 3600 seconden liggen."
    );
  }
  return value;
}

function optionalTransition(formData: FormData, playlistId: string) {
  const value = String(formData.get("defaultTransition") ?? "");
  if (!value) return null;
  if (!["cut", "crossfade", "wipe"].includes(value)) {
    fail(playlistId, "Kies een geldige standaardovergang voor de sectie.");
  }
  return value;
}

function nullableNumber(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) failList("Een numerieke iteminstelling is ongeldig.");
  return value;
}

function nullableText(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > maxLength) failList(`De waarde voor ${name} is te lang.`);
  return value || null;
}

function nullableIsoDate(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) failList("De gekozen zichtbaarheidstijd is ongeldig.");
  return parsed.toISOString();
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
  if (code === "P0002") return "De playlist of het item bestaat niet meer. Laad de nieuwste versie van de playlisteditor.";
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
