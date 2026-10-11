import { playlistBatchCommandSchema, type PlaylistBatchOperation } from "@veyocast/contracts";
import {sitesPresentationPages}from"@veyocast/content-templates/sites-presentation-model";
import type { Playlist, Slide } from "./model";

export function playlistPlacementPages(slide:Slide):number {
  return slide.studioSlide?sitesPresentationPages({...slide.studioSlide.presentation,slide:{...slide.studioSlide.presentation.slide,themeId:slide.studioSlide.themeId}}):slide.design?Math.max(1,Math.ceil(slide.design.rows.length/Math.max(1,Number(slide.design.sitesConfiguration.rowsPerPage)))):1;
}
const totalSeconds=(slide:Slide)=>Math.ceil(slide.seconds*playlistPlacementPages(slide));

/** A minimal patch keeps sections, crop, audio, visibility and immutable provenance intact. */
export function planPlaylistChanges(original: Playlist, next: Playlist, additions: ReadonlyMap<string, Slide>): PlaylistBatchOperation[] {
  const operations: PlaylistBatchOperation[] = [];
  const old = new Map(original.slides.map(slide => [slide.id, slide]));
  const wanted = new Set(next.slides.map(slide => slide.id));
  const added = new Set<string>();
  function add(slide: Slide) {
    if (old.has(slide.id) || added.has(slide.id)) return;
    if (slide.duplicateOf) {
      const source = old.get(slide.duplicateOf) ?? additions.get(slide.duplicateOf);
      if (!source) throw new Error("Het oorspronkelijke item voor deze kopie ontbreekt. Herstel de selectie en probeer opnieuw.");
      add(source);
      operations.push({ operation: "duplicate", clientId: slide.id, itemId: source.id });
      added.add(slide.id);
    } else if (slide.seriesClientId && slide.seriesClientItemIds && slide.studioProjectId && slide.seriesRevision) {
      if (added.has(slide.seriesClientId)) return;
      if (!slide.seriesClientItemIds.every(id => additions.has(id))) throw new Error("De Studio-reeks is onvolledig. Selecteer de hele reeks opnieuw.");
      operations.push({ operation: "add_studio_series", clientId: slide.seriesClientId, clientItemIds: slide.seriesClientItemIds, seriesId: slide.studioProjectId, expectedSeriesRevision: slide.seriesRevision });
      slide.seriesClientItemIds.forEach(id => added.add(id));
    } else if (slide.design) {
      operations.push({ operation: "add_dynamic", clientId: slide.id, dynamicSlideId: slide.design.id, expectedSnapshotId: slide.design.snapshotId, durationSeconds: totalSeconds(slide) });
      added.add(slide.id);
    } else if (slide.sourceKind === "youtube" && slide.sourceId) {
      operations.push({ operation: "add_youtube", clientId: slide.id, sourceId: slide.sourceId, durationSeconds: totalSeconds(slide) });
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
    if (previous?.design && slide.design && previous.design.snapshotId !== slide.design.snapshotId) operations.push({ operation: "refresh_dynamic", itemId: slide.id, expectedSnapshotId: slide.design.snapshotId });
    if ((previous || slide.seriesClientId || slide.duplicateOf) && (previous?.mediaId ?? additions.get(slide.id)?.mediaId) !== slide.mediaId && slide.mediaId && !slide.design && !slide.sourceKind) operations.push({ operation: "replace_media", itemId: slide.id, mediaAssetId: slide.mediaId });
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
