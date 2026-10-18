import { mediaFrameFocusCoordinates, playlistBatchCommandSchema, type PlaylistBatchCommand, type PlaylistBatchOperation } from "@veyocast/contracts";
import {sitesPresentationPages}from"@veyocast/content-templates/sites-presentation-model";
import type { Playlist, Slide } from "./model";
import {syncSlidePageCount} from '@veyocast/contracts';

export function playlistPlacementPages(slide:Slide):number {
  return slide.syncDynamic?syncSlidePageCount(slide.syncDynamic.presentation):slide.syncStudio?syncSlidePageCount(slide.syncStudio.presentation):slide.studioSlide?sitesPresentationPages({...slide.studioSlide.presentation,slide:{...slide.studioSlide.presentation.slide,themeId:slide.studioSlide.themeId}}):slide.design?Math.max(1,Math.ceil(slide.design.rows.length/Math.max(1,Number(slide.design.sitesConfiguration.rowsPerPage)))):1;
}
const totalSeconds=(slide:Slide)=>Math.ceil(slide.seconds*playlistPlacementPages(slide));

export const maximumPlaylistPlacementSeconds = (slide: Slide) => slide.mediaFrame ? 3600 : slide.syncStudio || slide.syncDynamic ? Math.floor(120 / playlistPlacementPages(slide)) : 180;

/** Choosing a new immutable frame changes defaults, not existing placement intent. */
export function refreshMediaFramePlacement(slide: Slide): Slide {
  const binding = slide.mediaFrame, current = binding?.current;
  if (!binding || !current || current.id === binding.selected.id || current.number <= binding.pinnedVersionNumber) throw Error("Er is geen nieuwere geverifieerde media-ontwerpversie beschikbaar.");
  const coordinates = mediaFrameFocusCoordinates(current.settings.focus);
  return { ...slide, mediaId: current.mediaAssetId, mediaChecksumSha256: current.checksumSha256, image: current.image, kind: current.kind, orientation: current.settings.orientation,
    name: binding.overrides.displayTitle || binding.edits?.displayTitle !== undefined ? slide.name : current.settings.name,
    seconds: binding.overrides.durationSeconds || binding.edits?.durationSeconds !== undefined ? slide.seconds : current.settings.durationSeconds,
    mediaFrame: { ...binding, selected: current,
      fitMode: binding.overrides.fitMode ? binding.fitMode : current.settings.fitMode,
      cropFocusX: binding.overrides.cropFocusX ? binding.cropFocusX : coordinates.x,
      cropFocusY: binding.overrides.cropFocusY ? binding.cropFocusY : coordinates.y,
      backgroundColor: binding.overrides.backgroundColor ? binding.backgroundColor : null,
    },
  };
}

/** A minimal patch keeps sections, crop, audio, visibility and immutable provenance intact. */
export function planPlaylistChanges(original: Playlist, next: Playlist, additions: ReadonlyMap<string, Slide>): PlaylistBatchOperation[] {
  if(next.slides.some(slide=>slide.syncDynamic&&((slide.themeId&&slide.themeId!==slide.syncDynamic.presentation.theme)||slide.seconds*playlistPlacementPages(slide)!==slide.syncDynamic.durationSeconds)))throw Error('Deze Source-keuze heeft nog geen passende volledige afspeeluitvoer. Je concept blijft behouden; bereid de gekozen variant eerst voor.');
  const operations: PlaylistBatchOperation[] = [];
  const old = new Map(original.slides.map(slide => [slide.id, slide]));
  const nextById = new Map(next.slides.map(slide=>[slide.id,slide]));
  const wanted = new Set(next.slides.map(slide => slide.id));
  const added = new Set<string>();
  function add(slide: Slide) {
    if (old.has(slide.id) || added.has(slide.id)) return;
    if (slide.duplicateOf) {
      const source = old.get(slide.duplicateOf) ?? nextById.get(slide.duplicateOf) ?? additions.get(slide.duplicateOf);
      if (!source) throw new Error("Het oorspronkelijke item voor deze kopie ontbreekt. Herstel de selectie en probeer opnieuw.");
      add(source);
      operations.push({ operation: "duplicate", clientId: slide.id, itemId: source.id });
      added.add(slide.id);
    } else if (slide.seriesClientId && slide.seriesClientItemIds && slide.studioProjectId && slide.seriesRevision) {
      if (added.has(slide.seriesClientId)) return;
      if (!slide.seriesClientItemIds.every(id => additions.has(id))) throw new Error("De Studio-reeks is onvolledig. Selecteer de hele reeks opnieuw.");
      operations.push({ operation: "add_studio_series", clientId: slide.seriesClientId, clientItemIds: slide.seriesClientItemIds, seriesId: slide.studioProjectId, expectedSeriesRevision: slide.seriesRevision });
      slide.seriesClientItemIds.forEach(id => added.add(id));
    } else if (slide.mediaFrame) {
      operations.push({ operation: "add_media_frame", clientId: slide.id, frameId: slide.mediaFrame.frameId, expectedVersionId: slide.mediaFrame.selected.id });
      added.add(slide.id);
    } else if(slide.syncDynamic){
      operations.push({operation:'add_sync_dynamic',clientId:slide.id,dynamicSlideId:slide.syncDynamic.id,expectedSnapshotId:slide.syncDynamic.placementVariantBaseSnapshotId??slide.syncDynamic.snapshotId,snapshotId:slide.syncDynamic.snapshotId,durationSeconds:totalSeconds(slide)});added.add(slide.id);
    } else if (slide.design) {
      operations.push({ operation: "add_dynamic", clientId: slide.id, dynamicSlideId: slide.design.id, expectedSnapshotId: slide.design.snapshotId, durationSeconds: totalSeconds(slide) });
      added.add(slide.id);
    } else if (slide.sourceKind === "youtube" && slide.sourceId) {
      operations.push({ operation: "add_youtube", clientId: slide.id, sourceId: slide.sourceId, durationSeconds: totalSeconds(slide) });
      if(slide.syncStudio&&slide.fallbackAssetId)operations.push({operation:'replace_fallback',itemId:slide.id,mediaAssetId:slide.fallbackAssetId,sourceKind:'youtube',sourceId:slide.sourceId});
      added.add(slide.id);
    } else if (slide.sourceKind === "engage" && slide.sourceId && slide.fallbackAssetId) {
      operations.push({ operation: "add_engage", clientId: slide.id, campaignId: slide.sourceId, fallbackAssetId: slide.fallbackAssetId, durationSeconds: totalSeconds(slide) });
      added.add(slide.id);
    } else if (slide.mediaId) {
      operations.push({ operation: "add_media", clientId: slide.id, mediaAssetId: slide.mediaId, durationSeconds: totalSeconds(slide) });
      added.add(slide.id);
    } else throw new Error("Dit item heeft geen geverifieerde afspeelbron. Kies gereedstaande inhoud uit de bibliotheek.");
  }
  next.slides.forEach(add);
  for (const slide of [...original.slides, ...[...added].map(id => additions.get(id)).filter((slide): slide is Slide => !!slide)]) {
    if (!wanted.has(slide.id)) operations.push({ operation: "remove", itemId: slide.id });
  }
  for (const slide of next.slides) {
    const previous = old.get(slide.id);
    const patch: Extract<PlaylistBatchOperation, { operation: "patch" }>["patch"] = {};
    if (slide.mediaFrame) {
      const copied = slide.duplicateOf ? old.get(slide.duplicateOf) ?? nextById.get(slide.duplicateOf) ?? additions.get(slide.duplicateOf) : undefined;
      const prior = previous?.mediaFrame ?? copied?.mediaFrame;
      if (prior && prior.frameId !== slide.mediaFrame.frameId) throw Error("Een media-ontwerpplaatsing kan niet stilzwijgend naar een ander ontwerp verwijzen.");
      if (prior && prior.pinnedVersionId !== slide.mediaFrame.selected.id) {
        if (!slide.mediaFrame.current || slide.mediaFrame.current.id !== slide.mediaFrame.selected.id) throw Error("Vernieuw eerst de actuele media-ontwerpversie; je concept blijft behouden.");
        operations.push({ operation: "refresh_media_frame", itemId: slide.id, expectedPinnedVersionId: prior.pinnedVersionId, versionId: slide.mediaFrame.selected.id });
      }
      // Defaults changed by refresh must never be written back as user overrides.
      // A deliberate same-value edit is still an explicit placement preference.
      const intent = slide.mediaFrame.edits;
      if (intent?.durationSeconds !== undefined) patch.durationSeconds = totalSeconds(slide);
      if (intent?.displayTitle !== undefined) patch.displayTitle = slide.name.trim();
      if (Object.keys(patch).length) operations.push({ operation: "patch", itemId: slide.id, patch });
      continue;
    }
    const copiedSource=slide.duplicateOf?(old.get(slide.duplicateOf)??nextById.get(slide.duplicateOf)??additions.get(slide.duplicateOf))?.syncDynamic:undefined;
    if((previous||slide.duplicateOf)&&slide.syncDynamic?.placementVariantBaseSnapshotId&&(previous?.syncDynamic?.snapshotId??copiedSource?.snapshotId)!==slide.syncDynamic.snapshotId){
      operations.push({operation:'use_sync_dynamic_variant',itemId:slide.id,expectedSnapshotId:slide.syncDynamic.placementVariantBaseSnapshotId,snapshotId:slide.syncDynamic.snapshotId,durationSeconds:totalSeconds(slide)});
    }else if(previous?.syncDynamic&&slide.syncDynamic&&previous.syncDynamic.snapshotId!==slide.syncDynamic.snapshotId)operations.push({operation:'refresh_dynamic',itemId:slide.id,expectedSnapshotId:slide.syncDynamic.snapshotId});
    if (previous?.design && slide.design && previous.design.snapshotId !== slide.design.snapshotId) operations.push({ operation: "refresh_dynamic", itemId: slide.id, expectedSnapshotId: slide.design.snapshotId });
    if ((previous || slide.seriesClientId || slide.duplicateOf) && (previous?.mediaId ?? additions.get(slide.id)?.mediaId) !== slide.mediaId && slide.mediaId && !slide.design && !slide.syncDynamic && !slide.sourceKind) operations.push({ operation: "replace_media", itemId: slide.id, mediaAssetId: slide.mediaId });
    const origin=previous??additions.get(slide.id);
    if(slide.sourceKind&&slide.sourceId&&slide.mediaId&&(origin?.mediaId??origin?.fallbackAssetId)!==slide.mediaId)operations.push({operation:'replace_fallback',itemId:slide.id,mediaAssetId:slide.mediaId,sourceKind:slide.sourceKind,sourceId:slide.sourceId});
    if (!previous || previous.seconds !== slide.seconds || playlistPlacementPages(previous) !== playlistPlacementPages(slide)) patch.durationSeconds = totalSeconds(slide);
    if (!previous || previous.name !== slide.name) patch.displayTitle = slide.name.trim();
    if (slide.design && (!previous?.design || JSON.stringify({...previous.design.sitesConfiguration,themeId:previous.design.themeId,seconds:previous.seconds}) !== JSON.stringify({ ...slide.design.sitesConfiguration, themeId: slide.design.themeId,seconds:slide.seconds }))) {
      patch.sitesConfiguration = { ...slide.design.sitesConfiguration, themeId: slide.design.themeId,seconds:slide.seconds };
    }
    if (Object.keys(patch).length) operations.push({ operation: "patch", itemId: slide.id, patch });
  }
  if (original.slides.map(slide => slide.id).join(",") !== next.slides.map(slide => slide.id).join(",")) operations.push({ operation: "reorder", itemIds: next.slides.map(slide => slide.id) });
  if (original.name !== next.name || original.description !== next.description) operations.push({ operation: "details", name: next.name, description: next.description });
  return operations;
}

export function validatePlaylistPlan(playlistId: string, revision: number, key: string, operations: PlaylistBatchOperation[]) {
  return playlistBatchCommandSchema.parse({ playlistId, expectedRevision: revision, idempotencyKey: key, operations });
}

export type PlaylistBatchScope = { tenantId: string; actorScope: string; playlistId: string };
export type PlaylistBatchJournal = PlaylistBatchScope & { schemaVersion: 1; command: PlaylistBatchCommand };
const journalUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const playlistBatchJournalKey = (scope: PlaylistBatchScope) => `veyocast-playlist-batch-v1:${encodeURIComponent(scope.actorScope)}:${scope.tenantId}:${scope.playlistId}`;

/** Persist only the canonical command, never a Slide or its temporary private URLs. */
export function validatePlaylistBatchScope(scope: PlaylistBatchScope) {
  const actor = scope.actorScope?.split(":");
  if (!journalUuid.test(scope.tenantId) || !journalUuid.test(scope.playlistId) || actor?.length !== 2 || actor[0] !== scope.tenantId || !journalUuid.test(actor[1] ?? "")) throw Error("De huidige gebruiker en vereniging konden niet worden bevestigd. Heropen de playlist.");
}
export function preparePlaylistBatchJournal(scope: PlaylistBatchScope, command: PlaylistBatchCommand): PlaylistBatchJournal {
  validatePlaylistBatchScope(scope);
  const parsed = playlistBatchCommandSchema.parse(command);
  if (parsed.playlistId !== scope.playlistId) throw Error("De oorspronkelijke opdracht hoort bij een andere playlist.");
  return { schemaVersion: 1, ...scope, command: parsed };
}

export function parsePlaylistBatchJournal(raw: string, scope: PlaylistBatchScope): PlaylistBatchJournal {
  if (raw.length > 300_000) throw Error("De oorspronkelijke playlistopdracht is te groot om veilig te herstellen.");
  const value = JSON.parse(raw) as PlaylistBatchJournal;
  if (!value || Object.keys(value).some(key => !["schemaVersion", "actorScope", "tenantId", "playlistId", "command"].includes(key)) || value.schemaVersion !== 1 || value.actorScope !== scope.actorScope || value.tenantId !== scope.tenantId || value.playlistId !== scope.playlistId) throw Error("De herstelgegevens horen niet bij deze gebruiker, vereniging en playlist.");
  return preparePlaylistBatchJournal(scope, value.command);
}
