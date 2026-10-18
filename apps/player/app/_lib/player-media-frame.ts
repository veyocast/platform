import { syncSystemAssets, type MediaFramePlaybackBackground, type PlayerDynamicTemplateAsset } from "@veyocast/contracts";
import { mediaFrameBackgroundStyle } from "../../../../packages/content-templates/src/media-frame-background";
import type { PlayerManifestItem, PlayerReleaseManifest } from "./player-manifest";

export const mediaFrameClubmuurAsset = syncSystemAssets.find(asset => asset.path === "/assets/clubmuur-wall.webp")!;

/** Self-contained so the same bounded validation can run in the LG script. */
export function validMediaFrameBackground(value: unknown, assetValues: unknown, clubmuur: { sha256: string; bytes: number; mimeType: string }): boolean {
  const record = value as Record<string, unknown> | undefined;
  const assets = assetValues as Record<string, Record<string, unknown>> | undefined;
  if (record === undefined) return assets === undefined || Boolean(assets && !Array.isArray(assets) && Object.keys(assets).length === 0);
  if (!record || Array.isArray(record) || Object.keys(record).sort().join() !== "accentColor,background,schemaVersion,themeId" || record.schemaVersion !== 1 || !["onzetrots-tv", "fieldflow"].includes(String(record.themeId)) || !/^#[a-f0-9]{6}$/i.test(String(record.accentColor))) return false;
  const background = record.background as Record<string, unknown> | null;
  if (!background || Array.isArray(background) || !assets || Array.isArray(assets)) return false;
  let key: string | null = null;
  if (background.kind === "preset") {
    if (Object.keys(background).sort().join() !== "kind,preset" || !["stadium", "dark", "light", "gradient", "stripes", "clubmuur"].includes(String(background.preset))) return false;
    if (background.preset === "clubmuur") key = "clubmuur";
  } else if (background.kind === "image") {
    if (Object.keys(background).sort().join() !== "checksumSha256,kind,mediaAssetId,position" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(background.mediaAssetId)) || !/^[a-f0-9]{64}$/.test(String(background.checksumSha256)) || !["center", "top", "bottom", "left", "right"].includes(String(background.position))) return false;
    key = String(background.mediaAssetId);
  } else return false;
  if (key === null) return Object.keys(assets).length === 0;
  if (Object.keys(assets).length !== 1 || !Object.prototype.hasOwnProperty.call(assets, key)) return false;
  const asset = assets[key];
  if (!asset || Array.isArray(asset) || typeof asset.url !== "string" || !asset.url || asset.url.length > 4096 || !Number.isSafeInteger(asset.bytes) || Number(asset.bytes) <= 0 || Number(asset.bytes) > 524288000 || !/^[a-f0-9]{64}$/.test(String(asset.checksumSha256)) || !["image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(String(asset.mimeType))) return false;
  return key === "clubmuur" ? asset.checksumSha256 === clubmuur.sha256 && asset.bytes === clubmuur.bytes && asset.mimeType === clubmuur.mimeType : asset.checksumSha256 === background.checksumSha256;
}

export function assertMediaFrameManifest(manifest: PlayerReleaseManifest) {
  for (const item of manifest.items) {
    if (!validMediaFrameBackground(item.mediaFrameBackground, item.mediaFrameBackgroundAssets, mediaFrameClubmuurAsset) || item.mediaFrameBackground && (item.dynamicTemplate || item.sitesStudioPresentation || item.syncStudioPresentation || item.syncDynamic || item.syncDynamicBinary || item.onlinePlayback)) throw Error("MEDIA_FRAME_BACKGROUND_INVALID");
  }
}

export function assertMediaFrameContinuity(previous: PlayerReleaseManifest, next: PlayerReleaseManifest) {
  if (previous.releaseId !== next.releaseId) return;
  const oldItems = new Map(previous.items.map(item => [item.id, item]));
  const identity = (item: PlayerManifestItem) => JSON.stringify({ background: item.mediaFrameBackground, assets: Object.entries(item.mediaFrameBackgroundAssets ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, asset]) => [id, asset.checksumSha256, asset.bytes, asset.mimeType]) });
  for (const item of next.items) {
    const old = oldItems.get(item.id);
    if (old?.mediaFrameBackground && identity(old) !== identity(item)) throw Error("MEDIA_FRAME_IMMUTABLE_BACKGROUND_CHANGED");
  }
}

export function playerMediaFrameBackgroundStyle(item: Pick<PlayerManifestItem, "mediaFrameBackground" | "mediaFrameBackgroundAssets">) {
  const value = item.mediaFrameBackground;
  if (!value) return undefined;
  return mediaFrameBackgroundStyle(value, { image: value.background.kind === "image" ? item.mediaFrameBackgroundAssets?.[value.background.mediaAssetId]?.url : undefined, clubmuur: item.mediaFrameBackgroundAssets?.clubmuur?.url }) ?? undefined;
}

export type PlayerMediaFrameBackgroundPayload = { mediaFrameBackground: MediaFramePlaybackBackground; mediaFrameBackgroundAssets: Record<string, PlayerDynamicTemplateAsset> };
