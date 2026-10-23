import { syncBackgroundAssetForRef, syncBackgroundScenes, type SyncBackgroundSceneId, type SyncSlidePresentation } from "@veyocast/contracts";

export const syncBackgroundPresets = [
  ["stadium", "Stadion"], ["gradient", "Verloop"], ["stripes", "Strepen"],
  ["clubmuur", "Clubmuur"], ["light", "Licht"],
] as const;
export type SyncBackgroundChoice = (typeof syncBackgroundPresets)[number][0] | SyncBackgroundSceneId;

/** Explicit authoring only. Never run this adapter over stored drafts or receipts. */
export function chooseSyncBackground(presentation: SyncSlidePresentation, choice: SyncBackgroundChoice): Partial<Pick<SyncSlidePresentation,"style"|"orientation">> {
  const scene = syncBackgroundScenes.find(value => value.id === choice);
  if (!scene) return { style: { ...presentation.style, background: choice as (typeof syncBackgroundPresets)[number][0], backgroundAsset: undefined } };
  const asset = scene[presentation.orientation];
  return { style: { ...presentation.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } };
}

/** Only a user's orientation change selects the paired photograph. Existing
 * private photographs, presets and immutable/recovered commands are untouched. */
export function orientSyncBackground(presentation: SyncSlidePresentation, orientation: SyncSlidePresentation["orientation"]): Partial<Pick<SyncSlidePresentation,"style"|"orientation">> {
  const current = syncBackgroundAssetForRef(presentation.style.backgroundAsset);
  const scene = current && syncBackgroundScenes.find(value => value.landscape.path === current.path || value.portrait.path === current.path);
  if (!scene || presentation.style.background !== "photo" || orientation === presentation.orientation) return { orientation };
  const asset = scene[orientation];
  return { orientation, style: { ...presentation.style, backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } };
}
