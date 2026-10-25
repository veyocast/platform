import {
  syncBackgroundAssetForRef,
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncDynamicPlaybackSchema,
  syncDynamicBinaryPlaybackSchema,
  syncSlideRendererAssets,
  syncSlideMinimumDurationMs,
  syncDomDescriptorMimeType,
} from "@veyocast/contracts";
import type { PlayerReleaseManifest } from "./player-manifest";

export function assertSyncDynamicConfigurationContinuity(previous:PlayerReleaseManifest,next:PlayerReleaseManifest){
 if(previous.releaseId!==next.releaseId)return;
 const items=new Map(previous.items.map(item=>[item.id,item]));
 for(const item of next.items){const old=items.get(item.id),before=old?.syncDynamic??old?.syncDynamicBinary,after=item.syncDynamic??item.syncDynamicBinary;
  if(before&&!after)throw Error('SYNC_DYNAMIC_PROFILE_UNAVAILABLE');
  if(before&&after&&(before.configurationSnapshotId!==after.configurationSnapshotId||before.configurationHash!==after.configurationHash||before.templateVersionId!==after.templateVersionId))throw Error('SYNC_DYNAMIC_CONFIGURATION_CHANGED');
  if(before&&after&&Number(after.dataRevision??0)<Number(before.dataRevision??0))throw Error('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');
  if(before?.dataRevision!==undefined&&after?.dataRevision===before.dataRevision&&after.contentHash!==before.contentHash)throw Error('SYNC_DYNAMIC_DATA_REVISION_COLLISION');
 }
}

/** The independent Source manifest is never appended to the old strict 82-asset manifest. */
export function assertSyncPlayerAssetManifest(
  manifest: PlayerReleaseManifest,
): void {
  if(![1,2].includes(manifest.schemaVersion)||(manifest.schemaVersion===2)!==manifest.items.some(item=>item.kind==='composition'))throw Error('SYNC_DOM_ENVELOPE_VERSION_INVALID');
  const declared = manifest.syncSystemAssets,
    items = manifest.items.filter(
      (item) => item.syncStudioPresentation !== undefined||item.syncDynamic!==undefined,
    );
  for(const item of manifest.items)if(item.syncDynamicBinary!==undefined){const parsed=syncDynamicBinaryPlaybackSchema.safeParse(item.syncDynamicBinary);if(!parsed.success||item.syncDynamic||item.syncStudioPresentation||item.sitesStudioPresentation||item.dynamicTemplate||parsed.data.fallbackChecksumSha256!==item.source.checksumSha256)throw Error('SYNC_DYNAMIC_BINARY_INVALID');}
  if (items.length && !declared) throw Error("SYNC_ASSET_MANIFEST_INVALID");
  if (declared) {
    const extraBackgrounds = items.flatMap(item => {
      const parsed = syncSlidePresentationSchema.safeParse(item.syncDynamic?.presentation ?? item.syncStudioPresentation);
      const asset = parsed.success && syncBackgroundAssetForRef(parsed.data.style.backgroundAsset);
      return asset ? [asset] : [];
    });
    const expected = new Map(
      [...items.flatMap(item=>{const parsed=syncSlidePresentationSchema.safeParse(item.syncDynamic?.presentation??item.syncStudioPresentation);return parsed.success?syncSlideRendererAssets(parsed.data):[];}),...extraBackgrounds].map((asset) => [asset.path as string, asset]),
    );
    if (
      declared.length !== expected.size ||
      new Set(declared.map((asset) => asset.path)).size !== expected.size ||
      declared.some((asset) => {
        const actual = expected.get(
          asset.path,
        );
        return (
          !actual ||
          actual.sha256 !== asset.checksumSha256 ||
          actual.bytes !== asset.bytes ||
          actual.mimeType !== asset.mimeType
        );
      })
    )
      throw Error("SYNC_ASSET_MANIFEST_INVALID");
  }
  for (const item of items) {
    const dynamic=item.syncDynamic===undefined?null:syncDynamicPlaybackSchema.safeParse(item.syncDynamic);
    if(dynamic&&(!dynamic.success||item.syncStudioPresentation||item.sitesStudioPresentation||item.dynamicTemplate||
      (dynamic.data.schemaVersion===1?item.kind==='composition'||dynamic.data.fallbackChecksumSha256!==item.source.checksumSha256:
        item.kind!=='composition'||item.source.mimeType!==syncDomDescriptorMimeType||dynamic.data.descriptorChecksumSha256!==item.source.checksumSha256||!item.source.url||item.source.bytes<1||item.source.bytes>550000)))throw Error('SYNC_DYNAMIC_PRESENTATION_INVALID');
    const content=dynamic?.success?dynamic.data:null;
    const parsed = syncSlidePresentationSchema.safeParse(
        content?.presentation??item.syncStudioPresentation,
      ),
      duration = content?.durationMs??item.syncStudioDurationMs;
    if (
      !parsed.success ||
      item.sitesStudioPresentation ||
      !Number.isInteger(duration) ||
      Number(duration) < syncSlideMinimumDurationMs(parsed.data) ||
      Number(duration) > 120000 ||
      (!content&&item.durationSeconds * 1000 < Number(duration))
    )
      throw Error("SYNC_STUDIO_PRESENTATION_INVALID");
    const refs = syncSlideAssets(parsed.data).filter(
        (asset) => asset.kind === "tenant",
      ),
      expectedIds = new Set(refs.map((asset) => asset.mediaAssetId));
    if (
      Object.keys(content?.assets??item.syncStudioAssets ?? {}).length !== expectedIds.size ||
      refs.some((ref) => {
        const asset = (content?.assets??item.syncStudioAssets)?.[ref.mediaAssetId];
        return (
          !asset ||
          asset.checksumSha256 !== ref.checksumSha256 ||
          !asset.mimeType.startsWith("image/") ||
          !Number.isSafeInteger(asset.bytes) ||
          asset.bytes <= 0
        );
      })
    )
      throw Error("SYNC_STUDIO_ASSETS_UNAVAILABLE");
  }
  if(manifest.items.some(item=>item.kind==='composition'&&item.syncDynamic?.schemaVersion!==2))throw Error('SYNC_DOM_CAPABILITY_REQUIRED');
}
