import type { PlayerManifestItem } from "./player-manifest";

/** Every supported dynamic transport shares the authorized manifest boundary.
 * This includes historical Menu/RSS/Sportlink payloads and binary-only profiles;
 * no renderer contacts a provider when an occurrence starts. */
export function isDynamicPlayerItem(item: PlayerManifestItem): boolean {
  return Boolean(item.dynamicData || item.dynamicTemplate || item.menuDom || item.syncDynamic ||
    item.syncDynamicBinary || item.syncStudioPresentation ||
    item.sitesStudioPresentation || item.sitesPresentation || item.onlinePlayback);
}

/** Data, signed access and render readiness are deliberately absent. They can
 * redraw an occurrence, but only its actual playback clock starts a new one. */
export function playerActivationIdentity(
  releaseId: string,
  zoneId: string,
  itemIndex: number,
  iteration: number
): string {
  return `${releaseId}:${zoneId}:${itemIndex}:${iteration}`;
}
