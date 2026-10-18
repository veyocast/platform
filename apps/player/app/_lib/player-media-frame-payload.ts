import { mediaFrameProvenanceSchema, type PlayerDynamicTemplateAsset } from "@veyocast/contracts";
import { mediaFrameClubmuurAsset, type PlayerMediaFrameBackgroundPayload } from "./player-media-frame";

/** Resolve only the frozen publication, never a mutable current frame version. */
export async function readPlayerMediaFramePayload(value: unknown, tenantId: string, source: { storageBucket: string; storagePath: string; checksumSha256: string; bytes: number; mimeType: string }, sign: (bucket: string, path: string) => Promise<string>): Promise<PlayerMediaFrameBackgroundPayload | undefined> {
  if (value == null) return undefined;
  const parsed = mediaFrameProvenanceSchema.safeParse(value);
  if (!parsed.success || parsed.data.tenantId !== tenantId) throw Error("MEDIA_FRAME_PROVENANCE_INVALID");
  const provenance = parsed.data, main = provenance.sourceAssets.find(ref => ref.role === "media")!;
  if (main.storageBucket !== source.storageBucket || main.storagePath !== source.storagePath || main.checksumSha256 !== source.checksumSha256 || main.byteSize !== source.bytes || main.mimeType !== source.mimeType) throw Error("MEDIA_FRAME_SOURCE_CHANGED");
  // An explicit placement color keeps its existing authority, including an
  // explicit cleared value. Background overrides never cause hidden downloads.
  if (provenance.overrides.backgroundColor) return undefined;
  const appearance = provenance.settings.appearance, background = appearance.background;
  const assets: Record<string, PlayerDynamicTemplateAsset> = {};
  if (background.kind === "image") {
    const ref = provenance.sourceAssets.find(ref => ref.role === "background" && ref.mediaAssetId === background.mediaAssetId)!;
    assets[ref.mediaAssetId] = { checksumSha256: ref.checksumSha256, bytes: ref.byteSize, mimeType: ref.mimeType, url: await sign(ref.storageBucket, ref.storagePath) };
    return { mediaFrameBackground: { schemaVersion: 1, themeId: appearance.themeId, accentColor: appearance.accentColor, background: { ...background, checksumSha256: ref.checksumSha256 } }, mediaFrameBackgroundAssets: assets };
  }
  if (background.preset === "clubmuur") assets.clubmuur = { checksumSha256: mediaFrameClubmuurAsset.sha256, bytes: mediaFrameClubmuurAsset.bytes, mimeType: mediaFrameClubmuurAsset.mimeType, url: mediaFrameClubmuurAsset.path };
  return { mediaFrameBackground: { schemaVersion: 1, themeId: appearance.themeId, accentColor: appearance.accentColor, background }, mediaFrameBackgroundAssets: assets };
}
