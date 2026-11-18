import "server-only";

import { loadDraftPreflight } from "../releases/data";
import { loadPlaylistStudio } from "./data";
import { getReadinessCopy } from "./readiness-copy";
import { loadPublicationMediaPreview } from "./publish-media-frame-preview.server";

export class PlaylistPublicationBlocked extends Error {}

export class PlaylistPublicationConflict extends Error {
  constructor(readonly actualRevision: number) { super("Het playlistconcept is gewijzigd. Controleer de actuele versie."); }
}

export async function checkPlaylistPublication(input: { tenantId: string; playlistId: string; revision: number; screenIds: string[] }) {
  if (!input.screenIds.length || new Set(input.screenIds).size !== input.screenIds.length) throw new PlaylistPublicationBlocked("Kies minimaal één verschillend doelscherm. Er is geen release gemaakt.");
  const studio = await loadPlaylistStudio(input.tenantId, input.playlistId, false);
  if (!studio.playlist || !studio.readiness) throw new PlaylistPublicationBlocked("Het concept kon niet opnieuw worden gecontroleerd. Er is geen release gemaakt.");
  if (studio.playlist.revision !== input.revision) throw new PlaylistPublicationConflict(studio.playlist.revision);
  if (!studio.readiness.canPublish) {
    const blocker = studio.readiness.reasons[0];
    const message = blocker ? getReadinessCopy(blocker) : null;
    throw new PlaylistPublicationBlocked(message ? `${message.label}. ${message.detail} ${message.recovery}` : "De playlist is nog niet klaar voor publicatie.");
  }
  const enabledSections = new Set(studio.sections.filter(section => section.enabled).map(section => section.id));
  let targetItems: Array<{ checksumSha256: string; fileSizeBytes: number; sourceDomProtocol?: 2 }> = studio.items.flatMap(item =>
    item.enabled && (item.sectionId === null || enabledSections.has(item.sectionId)) && item.asset?.variant
      ? [{ checksumSha256: item.asset.variant.checksumSha256, fileSizeBytes: item.asset.variant.fileSizeBytes }] : []);
  if (studio.items.some(item => item.asset?.kind === "composition")) {
    try { targetItems = (await loadPublicationMediaPreview(input.tenantId, studio.items, enabledSections)).targetItems; }
    catch { throw new PlaylistPublicationBlocked("De complete weergave kon niet worden gecontroleerd. Je concept blijft behouden; vernieuw de playlist en probeer opnieuw."); }
  }
  const preflight = await loadDraftPreflight(input.tenantId, targetItems);
  if (preflight.error) throw new PlaylistPublicationBlocked(`${preflight.error} Er is geen release gemaakt.`);
  const targets = preflight.screenStates.filter(state => input.screenIds.includes(state.screen.id));
  if (targets.length !== input.screenIds.length) throw new PlaylistPublicationBlocked("Een of meer doelschermen zijn niet beschikbaar binnen deze vereniging.");
  if (targets.some(state => state.preflight.status === "blocked")) throw new PlaylistPublicationBlocked("Publiceren is geblokkeerd: minimaal één doelscherm is uitgeschakeld, incompatibel of heeft aantoonbaar onvoldoende opslag.");
  return { studio, targets, needsRiskConfirmation: targets.some(state => state.preflight.status === "warning" || state.preflight.status === "unknown") };
}
