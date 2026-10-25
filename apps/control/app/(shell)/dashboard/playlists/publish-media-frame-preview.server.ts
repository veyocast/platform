import "server-only";
import type { CSSProperties } from "react";
import { readSyncDynamicDomArtifact,syncSlideAssets,syncSlideRendererAssets,mediaFrameSettingsSchema, syncSystemAssets, type MediaFramePlaybackBackground } from "@veyocast/contracts";
import { mediaFrameBackgroundStyle } from "../../../../../../packages/content-templates/src/media-frame-background";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { PlaylistStudioData } from "./data";
import { loadCanonicalSnapshotAssets,loadMediaFramePlacements } from "./library";
import type { MediaFramePlacement } from "./_components/sites/model";
import type { PlaylistPreviewItem } from "./playlist-preview";

type Item = PlaylistStudioData["items"][number];
type Download = { checksumSha256: string; fileSizeBytes: number;sourceDomProtocol?:2 };
const sha = /^[a-f0-9]{64}$/;
const failed = () => new Error("De vastgezette media-ontwerpversie of achtergrond kon niet volledig worden gecontroleerd. Je concept is behouden; open de playlist opnieuw voordat je publiceert.");
const validBytes = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

/** Original unbound representation, with no frame properties or new read boundary. */
function unboundPreview(item: Item): PlaylistPreviewItem | null {
  if (!item.asset?.variant?.previewUrl||item.asset.kind==='composition') return null;
  return {
    accessibilityName: item.accessibilityName || undefined, backgroundColor: item.backgroundColor || undefined,
    cropFocus: { x: item.cropFocusX, y: item.cropFocusY }, displayTitle: item.displayTitle || undefined,
    durationSeconds: item.durationSeconds, enabled: item.enabled, fitMode: item.fitMode, id: item.id,
    kind: item.asset.kind, muted: item.muted, title: item.asset.title, transition: item.transition,
    trim: { endSeconds: item.trimEndSeconds ?? undefined, startSeconds: item.trimStartSeconds },
    url: item.asset.variant.previewUrl,
    visibility: item.visibleFrom || item.visibleUntil ? { from: item.visibleFrom ?? undefined, until: item.visibleUntil ?? undefined } : undefined,
    volumePercent: item.volumePercent,
  };
}

/** Project verified pinned sources. A newer current or preferred asset is never substituted. */
export function projectPublicationMediaPreview(items: Item[], enabledSections: ReadonlySet<string>, bindings: ReadonlyMap<string, MediaFramePlacement>) {
  const targetItems: Download[] = [], previewItems: PlaylistPreviewItem[] = [];
  let hasFrames = false;
  for (const item of items) {
    const active = item.enabled && (item.sectionId === null || enabledSections.has(item.sectionId));
    if (!item.mediaFrameId && !item.mediaFrameVersionId) {
      if (active && item.asset?.variant) targetItems.push({ checksumSha256: item.asset.variant.checksumSha256, fileSizeBytes: item.asset.variant.fileSizeBytes,...(item.domReady?{sourceDomProtocol:2 as const}:{}) });
      const preview = unboundPreview(item); if (preview) previewItems.push(preview);
      continue;
    }
    hasFrames = true;
    const binding = bindings.get(item.id), selected = binding?.selected;
    if (!binding || !selected || binding.frameId !== item.mediaFrameId || binding.pinnedVersionId !== item.mediaFrameVersionId || selected.id !== item.mediaFrameVersionId || selected.mediaAssetId !== item.mediaAssetId || !sha.test(selected.checksumSha256) || !validBytes(selected.byteSize) || !selected.image || !mediaFrameSettingsSchema.safeParse(selected.settings).success) throw failed();
    let background: CSSProperties;
    const downloads: Download[] = [{ checksumSha256: selected.checksumSha256, fileSizeBytes: selected.byteSize }];
    if (binding.overrides.backgroundColor) background = { background: binding.backgroundColor ?? "var(--vc-brand-ink-black)" };
    else {
      const settings = selected.settings, choice = settings.appearance.background;
      let value: MediaFramePlaybackBackground;
      if (choice.kind === "image") {
        if (!selected.backgroundImage || !sha.test(selected.backgroundChecksumSha256 ?? "") || !validBytes(selected.backgroundByteSize)) throw failed();
        value = { schemaVersion: 1, themeId: settings.appearance.themeId, accentColor: settings.appearance.accentColor, background: { ...choice, checksumSha256: selected.backgroundChecksumSha256! } };
        downloads.push({ checksumSha256: selected.backgroundChecksumSha256!, fileSizeBytes: selected.backgroundByteSize });
      } else value = { schemaVersion: 1, themeId: settings.appearance.themeId, accentColor: settings.appearance.accentColor, background: choice };
      const clubmuur = syncSystemAssets.find(asset => asset.path === "/assets/clubmuur-wall.webp");
      if (choice.kind === "preset" && choice.preset === "clubmuur") {
        if (!clubmuur) throw failed();
        downloads.push({ checksumSha256: clubmuur.sha256, fileSizeBytes: clubmuur.bytes });
      }
      const style = mediaFrameBackgroundStyle(value, { image: selected.backgroundImage, clubmuur: clubmuur?.path });
      if (!style) throw failed(); background = style;
    }
    if (active) targetItems.push(...downloads);
    const legacy = unboundPreview(item);
    const base: PlaylistPreviewItem = legacy ?? { id: item.id, kind: selected.kind, title: selected.settings.name, durationSeconds: item.durationSeconds, fitMode: item.fitMode, muted: item.muted, enabled: item.enabled, url: selected.image };
    previewItems.push({ ...base, kind: selected.kind, url: selected.image,
      mediaFrameStyle: { ...background, objectFit: binding.fitMode, objectPosition: `${binding.cropFocusX * 100}% ${binding.cropFocusY * 100}%` },
    });
  }
  if (!hasFrames) return { targetItems, previewItems, hasFrames, totalBytes: targetItems.reduce((sum, item) => sum + item.fileSizeBytes, 0) };
  const unique = new Map<string, Download>();
  for (const item of targetItems) { const previous = unique.get(item.checksumSha256); if (previous && previous.fileSizeBytes !== item.fileSizeBytes) throw failed(); unique.set(item.checksumSha256, item); }
  return { targetItems: [...unique.values()], previewItems, hasFrames, totalBytes: [...unique.values()].reduce((sum, item) => sum + item.fileSizeBytes, 0) };
}

export async function loadPublicationMediaPreview(tenantId: string, items: Item[], enabledSections: ReadonlySet<string>) {
  const domItems=items.filter(item=>item.asset?.kind==='composition');
  if (!domItems.length&&!items.some(item => item.mediaFrameId || item.mediaFrameVersionId)) return projectPublicationMediaPreview(items, enabledSections, new Map());
  const client = await createControlSupabaseClient(); if (!client) throw failed();
  const bindings = items.some(item=>item.mediaFrameId||item.mediaFrameVersionId)?await loadMediaFramePlacements(client, tenantId, items):new Map<string,MediaFramePlacement>();
  const result=projectPublicationMediaPreview(items, enabledSections, bindings);
  if(!domItems.length)return result;
  const snapshots=await client.from('dynamic_slide_snapshots').select('id,snapshot_data_json,sync_render_result_json,output_media_asset_id,status').eq('tenant_id',tenantId).in('id',domItems.map(item=>item.dynamicSnapshotId!));
  if(snapshots.error)throw failed();
  const assets=await loadCanonicalSnapshotAssets(tenantId,(snapshots.data??[]).flatMap(snapshot=>[snapshot.snapshot_data_json,snapshot.sync_render_result_json]));
  for(const item of domItems){
    const snapshot=snapshots.data?.find(snapshot=>snapshot.id===item.dynamicSnapshotId),data=snapshot?.snapshot_data_json as {syncConfiguration?:unknown}|null;
    const checked=readSyncDynamicDomArtifact(data?.syncConfiguration,snapshot?.sync_render_result_json);
    if(!item.domReady||!checked||snapshot?.status!=='ready'||snapshot.output_media_asset_id!==item.mediaAssetId)throw failed();
    const assetUrls:Record<string,string>={},active=item.enabled&&(item.sectionId===null||enabledSections.has(item.sectionId));
    for(const ref of syncSlideAssets(checked.artifact.presentation))if(ref.kind==='tenant'){
      const asset=assets[ref.mediaAssetId];if(!asset||asset.checksumSha256!==ref.checksumSha256)throw failed();assetUrls[ref.mediaAssetId]=asset.url;
      if(active)result.targetItems.push({checksumSha256:asset.checksumSha256,fileSizeBytes:asset.bytes});
    }
    if(active)result.targetItems.push(...syncSlideRendererAssets(checked.artifact.presentation).map(asset=>({checksumSha256:asset.sha256,fileSizeBytes:asset.bytes})));
    result.previewItems.push({id:item.id,kind:'image',title:item.asset!.title,durationSeconds:item.durationSeconds,fitMode:item.fitMode,muted:item.muted,enabled:item.enabled,url:'',syncPreview:{presentation:checked.artifact.presentation,assetUrls}});
  }
  const unique=new Map(result.targetItems.map(item=>[item.checksumSha256,item]));
  return{...result,targetItems:[...unique.values()],previewItems:result.previewItems.sort((a,b)=>items.findIndex(item=>item.id===a.id)-items.findIndex(item=>item.id===b.id)),totalBytes:[...unique.values()].reduce((sum,item)=>sum+item.fileSizeBytes,0)};
}
