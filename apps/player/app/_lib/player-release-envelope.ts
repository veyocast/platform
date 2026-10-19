import "server-only";
import {sitesPresentationAssets} from "@veyocast/content-templates/sites-presentation-model";
import {buildPlayerSitesMarkup} from "./player-sites-markup";
import { createHash } from "node:crypto";

import sitesSystemAssets from "../../../../packages/content-templates/src/sites-system-assets.json";

import {
  syncSlidePresentationSchema, syncSlideAssets, syncSlidePageCount, syncSystemAssets, syncBackgroundAssetForRef, type SyncSlidePresentation,
  syncDynamicPlaybackSchema,
  syncDynamicConfigurationSchema,
  sitesDynamicConfigurationSchema,
  sitesPresentationSchema,
  type SitesPresentation,
  playerYouTubePlaybackSchema,
  playerDynamicTemplateAssetSchema,
  playerDynamicTemplatePayloadSchema,
  playerSponsorPlanSchema,
  type PlayerDynamicTemplateAsset,
  type PlayerDynamicTemplatePayload,
  type PlayerSponsorPlan
} from "@veyocast/contracts";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem,
  PlayerManifestPresentationDefaults,
  PlayerManifestTransition
} from "./player-manifest";
import {
  buildDynamicTemplatePayloadMap,
  type DynamicTemplatePayloadRow,
  type DynamicTemplatePayloadVersionRow
} from "./player-dynamic-template-payload";
import { createPlayerAdminClient } from "./player-supabase";
import {readSyncDynamicReleaseSnapshot,projectSyncDynamicReleaseData,syncDynamicProjectionAssetIds,type SyncDynamicSnapshotRow} from './player-sync-dynamic-payload';
import {readSyncPublishedBinaryArtifact} from './player-sync-binary-payload';
import type {SyncDynamicMode} from './sync-player-capabilities';
import { readPlayerMediaFramePayload } from "./player-media-frame-payload";

type ReleaseRow = {
  id: string;
  manifest_hash: string;
  manifest_json: unknown;
  playlist_id: string;
  published_at: string;
  tenant_id: string;
  total_bytes: number;
  total_duration_seconds: number;
  version: number;
};

type ReleaseItemRow = {
  source_item_id: string | null;
  live_data_enabled: boolean;
  accessibility_name: string | null;
  asset_kind: "image" | "video";
  asset_title: string;
  background_color: string | null;
  checksum_sha256: string;
  crop_focus_x: number;
  crop_focus_y: number;
  display_title: string | null;
  duration_seconds: number;
  dynamic_snapshot_id: string | null;
  enabled: boolean;
  engage_public_id: string | null;
  engage_question: string | null;
  engage_title: string | null;
  file_size_bytes: number;
  fit_mode: "contain" | "cover";
  id: string;
  mime_type: string;
  muted: boolean;
  section_name: string | null;
  section_position_key: number | null;
  section_source_id: string | null;
  storage_bucket: string;
  storage_path: string;
  transition: PlayerManifestTransition;
  trim_end_seconds: number | null;
  trim_start_seconds: number;
  visible_from: string | null;
  visible_until: string | null;
  volume_percent: number;
  youtube_online_only: boolean | null;
  youtube_title: string | null;
  youtube_video_id: string | null;
  youtube_playlist_id:string|null;youtube_playlist_video_ids:unknown;youtube_playlist_repeat:boolean|null;
  sites_configuration_json:unknown;
  sites_studio_presentation_json:unknown;
  sync_studio_presentation_json?:unknown;
  sync_studio_duration_ms?:number|null;
  media_frame_provenance_json?:unknown;
};

export type PlayerReleaseDevice = {
  activeReleaseId: string;
  desiredReleaseId: string;
  id: string;
  screenId: string;
  screenName: string;
};

export async function loadPlayerReleaseEnvelope({
  device,
  releaseId,
  tenantId,
  enableSyncStudio = false,
  enableSyncBackgrounds = false,
  syncDynamicMode=false,
}: {
  enableSyncStudio?:boolean;
  enableSyncBackgrounds?:boolean;
  syncDynamicMode?:SyncDynamicMode;
  device: PlayerReleaseDevice;
  releaseId: string;
  tenantId: string;
}): Promise<PlayerManifestEnvelope> {
  const admin = createPlayerAdminClient();
  const [releaseResult, itemResult] = await Promise.all([
    admin
      .from("playlist_releases")
      .select("id, tenant_id, playlist_id, version, manifest_hash, manifest_json, published_at, total_duration_seconds, total_bytes")
      .eq("id", releaseId)
      .eq("tenant_id", tenantId)
      .single(),
    admin
      .from("playlist_release_items")
      .select("id, source_item_id, live_data_enabled, asset_kind, asset_title, display_title, duration_seconds, fit_mode, muted, transition, crop_focus_x, crop_focus_y, background_color, volume_percent, trim_start_seconds, trim_end_seconds, visible_from, visible_until, enabled, accessibility_name, section_source_id, section_name, section_position_key, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256, dynamic_snapshot_id, youtube_video_id, youtube_title, youtube_online_only, youtube_playlist_id, youtube_playlist_video_ids, youtube_playlist_repeat, sites_configuration_json, sites_studio_presentation_json, sync_studio_presentation_json, sync_studio_duration_ms, media_frame_provenance_json, engage_public_id, engage_title, engage_question")
      .eq("release_id", releaseId)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
  ]);

  if (releaseResult.error || itemResult.error || !releaseResult.data) {
    throw new Error("release unavailable");
  }

  const release = releaseResult.data as ReleaseRow;
  const releaseItems = (itemResult.data ?? []) as ReleaseItemRow[];
  if (releaseItems.length === 0) throw new Error("release has no items");
  const presentationDefaults = readPresentationDefaults(release.manifest_json);
  const configurationHashes = new Map<string, string>();
  const syncDynamicSnapshots=new Map<string,ReturnType<typeof readSyncDynamicReleaseSnapshot>>();
  const dynamicTemplates = await loadDynamicTemplatePayloads(
    admin,
    releaseItems,
    tenantId,
    configurationHashes,
    syncDynamicMode,syncDynamicSnapshots,enableSyncBackgrounds,
  );
  const binaryArtifacts=new Map<string,ReturnType<typeof readSyncPublishedBinaryArtifact>['artifact']>();
  const dynamicDomIds = new Set([...syncDynamicSnapshots].filter(([, value]) => syncDynamicMode === 'dom' && (enableSyncBackgrounds || !syncBackgroundAssetForRef(value.presentation.style.backgroundAsset))).map(([id]) => id));
  if(syncDynamicMode){
    const selected=releaseItems.filter(item=>item.live_data_enabled&&item.dynamic_snapshot_id&&syncDynamicSnapshots.has(item.id)&&!dynamicDomIds.has(item.id)),ids=[...new Set(selected.map(item=>item.dynamic_snapshot_id!))];
    if(ids.length){
      const result=await admin.rpc('get_sync_binary_playback_v1',{p_tenant_id:tenantId,p_snapshot_ids:ids});
      if(result.error||!Array.isArray(result.data)||result.data.length>ids.length)throw Error('SYNC_DYNAMIC_BINARY_UNAVAILABLE');
      const rows=new Map<string,unknown>();
      for(const row of result.data){if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.snapshotId!=='string'||!ids.includes(row.snapshotId)||rows.has(row.snapshotId))throw Error('SYNC_DYNAMIC_BINARY_INVALID');rows.set(row.snapshotId,row);}
      for(const item of selected){const row=rows.get(item.dynamic_snapshot_id!);if(!row)continue;const fresh=readSyncPublishedBinaryArtifact(syncDynamicSnapshots.get(item.id)!,row,tenantId);binaryArtifacts.set(item.id,fresh.artifact);syncDynamicSnapshots.set(item.id,fresh.value);}
    }
  }
  const studioPresentations=new Map<string,Extract<SitesPresentation,{kind:"studio"}>>();
  for(const item of releaseItems){if(item.sites_studio_presentation_json==null)continue;const parsed=sitesPresentationSchema.safeParse(item.sites_studio_presentation_json);if(!parsed.success||parsed.data.kind!=="studio")throw new Error("SITES_STUDIO_RELEASE_INVALID");studioPresentations.set(item.id,parsed.data);}
  const syncPresentations=new Map<string,SyncSlidePresentation>();
  if(enableSyncStudio) for(const item of releaseItems){
    if(item.sync_studio_presentation_json==null)continue;
    const parsed=syncSlidePresentationSchema.safeParse(item.sync_studio_presentation_json),duration=item.sync_studio_duration_ms;
    if(!parsed.success||item.sites_studio_presentation_json!=null||!Number.isInteger(duration)||Number(duration)<3000*syncSlidePageCount(parsed.data)||Number(duration)>120000||item.duration_seconds*1000<Number(duration))throw Error("SYNC_STUDIO_RELEASE_INVALID");
    if (enableSyncBackgrounds || !syncBackgroundAssetForRef(parsed.data.style.backgroundAsset)) syncPresentations.set(item.id,parsed.data);
  }
  const studioAssetRefs=[...[...studioPresentations.values()].flatMap(sitesPresentationAssets),...[...syncPresentations.values()].flatMap(syncSlideAssets),...[...syncDynamicSnapshots].flatMap(([id,value])=>dynamicDomIds.has(id)?syncSlideAssets(value.presentation):[])].filter(ref=>ref.kind==="tenant");
  const studioAssets=studioAssetRefs.length?await loadDynamicTemplateAssets(admin,tenantId,[...new Set(studioAssetRefs.map(ref=>ref.mediaAssetId))]):new Map<string,PlayerDynamicTemplateAsset>();
  if(studioAssetRefs.some(ref=>{const asset=studioAssets.get(ref.mediaAssetId);return !asset||asset.checksumSha256!==ref.checksumSha256||!asset.mimeType.startsWith("image/");}))throw new Error("SITES_STUDIO_ASSETS_UNAVAILABLE");
  const dynamicAssetBytes = uniqueDynamicAssetBytes(dynamicTemplates);
  const studioAssetBytes=[...studioAssets.values()].reduce((sum,asset)=>sum+asset.bytes,0);
  const sponsorPlan = await loadSponsorPlan(admin, tenantId, device.screenId);

  const items = await Promise.all(
    releaseItems.map(async (originalItem): Promise<PlayerManifestItem> => {
      const binary=binaryArtifacts.get(originalItem.id),item=binary?{...originalItem,storage_path:binary.storagePath,checksum_sha256:binary.checksumSha256,file_size_bytes:binary.byteLength,mime_type:binary.mimeType,asset_kind:binary.mimeType==='video/mp4'?'video' as const:'image' as const,duration_seconds:Math.max(originalItem.duration_seconds,binary.durationMs/1000)}:originalItem;
      const { data: signed, error: signedError } = await admin.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60 * 60);

      if (signedError || !signed?.signedUrl) {
        throw new Error("signed asset URL unavailable");
      }

      const frame = await readPlayerMediaFramePayload(item.media_frame_provenance_json, tenantId, { storageBucket: item.storage_bucket, storagePath: item.storage_path, checksumSha256: item.checksum_sha256, bytes: item.file_size_bytes, mimeType: item.mime_type }, async (bucket, path) => {
        const result = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (result.error || !result.data?.signedUrl) throw Error("MEDIA_FRAME_BACKGROUND_UNAVAILABLE");
        return result.data.signedUrl;
      });

      return {
        ...frame,
        accessibilityName: item.accessibility_name ?? item.asset_title,
        backgroundColor: item.background_color ?? undefined,
        cropFocus: {
          x: Number(item.crop_focus_x),
          y: Number(item.crop_focus_y)
        },
        displayTitle: item.display_title ?? item.asset_title,
        durationSeconds: item.duration_seconds,
        ...(studioPresentations.has(item.id)?{sitesStudioPresentation:studioPresentations.get(item.id),sitesStudioAssets:Object.fromEntries(sitesPresentationAssets(studioPresentations.get(item.id)!).flatMap(ref=>ref.kind==="tenant"?[[ref.mediaAssetId,studioAssets.get(ref.mediaAssetId)!]]:[]))}:{}),
        ...(syncPresentations.has(item.id)?{syncStudioPresentation:syncPresentations.get(item.id),syncStudioDurationMs:Number(item.sync_studio_duration_ms),syncStudioAssets:Object.fromEntries(syncSlideAssets(syncPresentations.get(item.id)!).flatMap(ref=>ref.kind==="tenant"?[[ref.mediaAssetId,studioAssets.get(ref.mediaAssetId)!]]:[]))}:{}),
        ...(syncDynamicSnapshots.has(item.id)?(dynamicDomIds.has(item.id)?{syncDynamic:syncDynamicPlaybackSchema.parse({...syncDynamicSnapshots.get(item.id)!.metadata,presentation:syncDynamicSnapshots.get(item.id)!.presentation,liveMatch:syncDynamicSnapshots.get(item.id)!.liveMatch,assets:Object.fromEntries(syncSlideAssets(syncDynamicSnapshots.get(item.id)!.presentation).flatMap(ref=>ref.kind==='tenant'?[[ref.mediaAssetId,studioAssets.get(ref.mediaAssetId)!]]:[]))})}:{syncDynamicBinary:syncDynamicSnapshots.get(item.id)!.metadata}):{}),
        ...(dynamicTemplates.get(item.id)
          ? { dynamicTemplate: dynamicTemplates.get(item.id) }
          : {}),
        ...(item.engage_public_id && item.engage_title && item.engage_question&&(!item.sync_studio_presentation_json||syncPresentations.has(item.id))
          ? {
              onlinePlayback: {
                kind: "engage" as const,
                publicId: item.engage_public_id,
                question: item.engage_question,
                title: item.engage_title
              }
            }
          : item.youtube_video_id && item.youtube_title && item.youtube_online_only
          ? {
              onlinePlayback: {
                kind: "youtube" as const,
                privacyEnhanced: true as const,
                title: item.youtube_title,
                videoId: item.youtube_video_id,
                ...(item.youtube_playlist_id?playerYouTubePlaybackSchema.parse({kind:"youtube",privacyEnhanced:true,title:item.youtube_title,videoId:item.youtube_video_id,playlistId:item.youtube_playlist_id,playlistVideoIds:item.youtube_playlist_video_ids,playlistRepeat:item.youtube_playlist_repeat}):{})
              }
            }
          : {}),
        enabled: item.enabled,
        fitMode: item.fit_mode,
        id: item.id,
        sourceItemId: item.source_item_id ?? item.id,
        contentHash: createHash("sha256").update(JSON.stringify({
          source: item.dynamic_snapshot_id ? configurationHashes.get(item.id)??item.checksum_sha256 : item.checksum_sha256,
          duration: item.duration_seconds, title: item.display_title, fit: item.fit_mode,
          crop: [item.crop_focus_x, item.crop_focus_y], background: item.background_color,
          ...(item.media_frame_provenance_json == null ? {} : { mediaFrame: item.media_frame_provenance_json }),
          muted: item.muted, volume: item.volume_percent, trim: [item.trim_start_seconds,item.trim_end_seconds],
          transition: item.transition, visibility: [item.visible_from,item.visible_until], enabled: item.enabled,
          youtube: [item.youtube_video_id,item.youtube_playlist_id,item.youtube_playlist_video_ids,item.youtube_playlist_repeat],sites:item.sites_configuration_json,studio:item.sites_studio_presentation_json, engage: item.engage_public_id
        })).digest("hex"),
        kind: item.asset_kind,
        muted: item.muted,
        section:
          item.section_source_id &&
          item.section_name &&
          item.section_position_key !== null
            ? {
                name: item.section_name,
                positionKey: Number(item.section_position_key),
                sourceSectionId: item.section_source_id
              }
            : undefined,
        source: {
          bytes: item.file_size_bytes,
          checksumSha256: item.checksum_sha256,
          mimeType: item.mime_type,
          url: signed.signedUrl
        },
        title: item.asset_title,
        transition: item.transition,
        trim: {
          endSeconds:
            item.trim_end_seconds === null
              ? undefined
              : Number(item.trim_end_seconds),
          startSeconds: Number(item.trim_start_seconds)
        },
        visibility:
          item.visible_from || item.visible_until
            ? {
                from: item.visible_from ?? undefined,
                until: item.visible_until ?? undefined
              }
            : undefined,
        volumePercent: item.volume_percent
      };
    })
  );

  for(const item of items)item.sitesPresentation=await buildPlayerSitesMarkup(item);
  const mainChecksums = new Set(items.map(item => item.source.checksumSha256));
  const frameAssetBytes = [...new Map(items.flatMap(item => Object.values(item.mediaFrameBackgroundAssets ?? {})).filter(asset => !mainChecksums.has(asset.checksumSha256)).map(asset => [asset.checksumSha256, asset])).values()].reduce((sum, asset) => sum + asset.bytes, 0);
  const needsSites=items.some(item=>item.sitesStudioPresentation||item.dynamicTemplate?.data.sitesConfiguration||((item.dynamicTemplate?.data.themePresentation as {selection?:{ref?:{id?:string}}}|undefined)?.selection?.ref?.id==="onzetrots-tv"));
  const systemAssets=needsSites?sitesSystemAssets.files.map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType})):undefined;
  const domPresentations = [...syncPresentations.values(), ...[...syncDynamicSnapshots].flatMap(([id,value]) => dynamicDomIds.has(id) ? [value.presentation] : [])];
  const extraBackgrounds = [...new Map(domPresentations.flatMap(value => { const asset = syncBackgroundAssetForRef(value.style.backgroundAsset); return asset ? [[asset.path, asset] as const] : []; })).values()];
  const syncAssets=domPresentations.length?[...syncSystemAssets,...extraBackgrounds].map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType})):undefined;
  const fetchedAt = new Date().toISOString();
  return {
    device,
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason:
        device.activeReleaseId === device.desiredReleaseId
          ? "desired release already active"
          : "desired release must be verified",
      syncStatus: "online"
    },
    fetchedAt,
    manifest: {
      items,
      label: `Playlist release ${release.version}`,
      manifestHash: release.manifest_hash,
      playlistId: release.playlist_id,
      publishedAt: release.published_at,
      releaseId: release.id,
      schemaVersion: 1,
      tenantId: release.tenant_id,
      totalBytes: release.total_bytes + items.reduce((sum,item,index)=>sum+item.source.bytes-releaseItems[index]!.file_size_bytes,0) + dynamicAssetBytes + studioAssetBytes + frameAssetBytes + uniqueSponsorAssetBytes(sponsorPlan)+(systemAssets?.reduce((sum,asset)=>sum+asset.bytes,0)??0)+(syncAssets?.reduce((sum,asset)=>sum+asset.bytes,0)??0),
      ...(systemAssets?{systemAssets}:{}),
      ...(syncAssets?{syncSystemAssets:syncAssets}:{}),
      totalDurationSeconds: release.total_duration_seconds+items.reduce((sum,item,index)=>sum+item.durationSeconds-releaseItems[index]!.duration_seconds,0),
      version: release.version,
      ...(presentationDefaults ? { presentationDefaults } : {}),
      ...(sponsorPlan ? { sponsorPlan } : {})
    },
    state:
      device.activeReleaseId === device.desiredReleaseId ? "PLAYING" : "READY"
  };
}

async function loadSponsorPlan(
  admin: ReturnType<typeof createPlayerAdminClient>,
  tenantId: string,
  screenId: string
): Promise<PlayerSponsorPlan | undefined> {
  const targetResult = await admin
    .from("sponsor_plan_targets")
    .select("plan_revision_id")
    .eq("tenant_id", tenantId)
    .eq("screen_id", screenId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (targetResult.error || !targetResult.data?.plan_revision_id) return undefined;
  const planResult = await admin
    .from("sponsor_plan_revisions")
    .select("plan_json,expires_at")
    .eq("tenant_id", tenantId)
    .eq("id", targetResult.data.plan_revision_id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (planResult.error || !planResult.data?.plan_json) return undefined;
  const rawPlan = planResult.data.plan_json;
  if (!isRecord(rawPlan) || !Array.isArray(rawPlan.placements)) return undefined;
  const placements = await Promise.all(
    rawPlan.placements.map(async (value) => {
      if (!isRecord(value) || !Array.isArray(value.creatives)) {
        throw new Error("invalid sponsor placement");
      }
      const creatives = await Promise.all(
        value.creatives.map(async (creativeValue) => {
          if (!isRecord(creativeValue) || typeof creativeValue.url !== "string") {
            throw new Error("invalid sponsor creative");
          }
          const storage = parseStorageUrl(creativeValue.url);
          if (!storage) throw new Error("invalid sponsor storage reference");
          const signed = await admin.storage
            .from(storage.bucket)
            .createSignedUrl(storage.path, 60 * 60);
          if (signed.error || !signed.data?.signedUrl) {
            throw new Error("sponsor asset unavailable");
          }
          return { ...creativeValue, url: signed.data.signedUrl };
        })
      );
      return { ...value, creatives };
    })
  );
  const parsed = playerSponsorPlanSchema.safeParse({ ...rawPlan, placements });
  return parsed.success ? parsed.data : undefined;
}

function parseStorageUrl(value: string) {
  if (!value.startsWith("storage://")) return null;
  const [bucket, ...path] = value.slice("storage://".length).split("/");
  return bucket && path.length ? { bucket, path: path.join("/") } : null;
}

function uniqueSponsorAssetBytes(plan: PlayerSponsorPlan | undefined) {
  if (!plan) return 0;
  const seen = new Set<string>();
  return plan.placements.reduce((total, placement) => placement.creatives.reduce((sum, creative) => {
    if (seen.has(creative.checksumSha256)) return sum;
    seen.add(creative.checksumSha256);
    return sum + creative.bytes;
  }, total), 0);
}

async function loadDynamicTemplatePayloads(
  admin: ReturnType<typeof createPlayerAdminClient>,
  releaseItems: ReleaseItemRow[],
  tenantId: string,
  configurationHashes: Map<string, string>,
  syncDynamicMode:SyncDynamicMode,
  syncDynamicSnapshots:Map<string,ReturnType<typeof readSyncDynamicReleaseSnapshot>>,
  enableSyncBackgrounds:boolean,
) {
  const snapshotIds = [
    ...new Set(
      releaseItems.flatMap((item) =>
        item.dynamic_snapshot_id ? [item.dynamic_snapshot_id] : []
      )
    )
  ];
  const result = new Map<string, PlayerDynamicTemplatePayload>();
  if (snapshotIds.length === 0) return result;

  const snapshotResult = syncDynamicMode?await admin
    .from('dynamic_slide_snapshots')
    .select('id, source_revision_hash, snapshot_data_json, template_version_id, dynamic_slide_version_id, status, sync_render_result_json')
    .eq('tenant_id',tenantId).in('id',snapshotIds):await admin
    .from("dynamic_slide_snapshots")
    .select("id, source_revision_hash, snapshot_data_json, template_version_id, dynamic_slide_version_id")
    .eq("tenant_id", tenantId)
    .in("id", snapshotIds);
  if (snapshotResult.error) return result;
  const originalSnapshots = (snapshotResult.data ?? []) as SyncDynamicSnapshotRow[];
  for (const item of releaseItems) {
    const snapshot = originalSnapshots.find((value) => value.id === item.dynamic_snapshot_id);
    if (snapshot) configurationHashes.set(item.id, JSON.stringify({
      version: snapshot.dynamic_slide_version_id, template: snapshot.template_version_id,
      theme: snapshot.snapshot_data_json.themePresentation, editorial: snapshot.snapshot_data_json.editorial,sites:item.sites_configuration_json,
      ...(Object.hasOwn(snapshot.snapshot_data_json,'syncConfiguration')?{sync:snapshot.snapshot_data_json.syncConfiguration}:{})
    }));
    if(snapshot&&syncDynamicMode&&Object.hasOwn(snapshot.snapshot_data_json,'syncConfiguration'))syncDynamicSnapshots.set(item.id,readSyncDynamicReleaseSnapshot(snapshot,item));
  }
  const legacySnapshots=originalSnapshots.filter(snapshot=>!Object.hasOwn(snapshot.snapshot_data_json,'syncConfiguration'));
  const legacyIds=new Set(legacySnapshots.map(snapshot=>snapshot.id));
  const liveIds = [...new Set(releaseItems.filter((item) => item.live_data_enabled&&item.dynamic_snapshot_id&&(legacyIds.has(item.dynamic_snapshot_id)||syncDynamicMode==='dom'&&syncDynamicSnapshots.has(item.id)&&(enableSyncBackgrounds||!syncBackgroundAssetForRef(syncDynamicSnapshots.get(item.id)!.presentation.style.backgroundAsset))))
    .flatMap((item) => item.dynamic_snapshot_id ? [item.dynamic_snapshot_id] : []))];
  const liveResult = liveIds.length ? await admin.from("published_dynamic_data")
    .select("snapshot_id,content_hash,data_json,data_revision,changed_at,last_error_code")
    .eq("tenant_id", tenantId).in("snapshot_id", liveIds) : null;
  const liveById = new Map((liveResult?.data ?? []).map((data) => [data.snapshot_id, data]));
  if(liveResult?.error&&syncDynamicMode==='dom'&&syncDynamicSnapshots.size)throw Error('SYNC_DYNAMIC_DATA_UNAVAILABLE');
  const sourceWork=releaseItems.flatMap(item=>{
    if(syncDynamicMode!=='dom'||!item.live_data_enabled||!item.dynamic_snapshot_id)return [];
    const live=liveById.get(item.dynamic_snapshot_id),snapshot=originalSnapshots.find(value=>value.id===item.dynamic_snapshot_id),base=syncDynamicSnapshots.get(item.id);
    if(!live||!snapshot||!base||(!enableSyncBackgrounds&&syncBackgroundAssetForRef(base.presentation.style.backgroundAsset)))return [];
    if(Number(live.data_revision)===1){base.metadata={...base.metadata,dataRevision:1};return [];}
    return [{itemId:item.id,snapshot,base,live}];
  });
  const snapshots = legacySnapshots.map((snapshot) => {
    const live = liveById.get(snapshot.id);
    return live ? { ...snapshot, snapshot_data_json: live.data_json as Record<string, unknown>,
      source_revision_hash: live.content_hash as string } : snapshot;
  });
  const versionIds = [
    ...new Set([...snapshots.map((snapshot) => snapshot.template_version_id),...sourceWork.map(value=>value.snapshot.template_version_id)])
  ];
  if (versionIds.length === 0) return result;

  const versionResult = await admin
    .from("dynamic_template_versions")
    .select("id, template_id")
    .in("id", versionIds);
  if (versionResult.error){if(sourceWork.length)throw Error('SYNC_DYNAMIC_DATA_UNAVAILABLE');return result;}
  const versions = (versionResult.data ??
    []) as DynamicTemplatePayloadVersionRow[];
  const templateIds = [
    ...new Set(versions.map((version) => version.template_id))
  ];
  if (templateIds.length === 0){if(sourceWork.length)throw Error('SYNC_DYNAMIC_DATA_UNAVAILABLE');return result;}

  const templateResult = await admin
    .from("dynamic_templates")
    .select("id, slug, slide_type, orientation")
    .in("id", templateIds);
  if (templateResult.error){if(sourceWork.length)throw Error('SYNC_DYNAMIC_DATA_UNAVAILABLE');return result;}
  const templates=(templateResult.data??[])as DynamicTemplatePayloadRow[];

  const payloads = buildDynamicTemplatePayloadMap({
    snapshots,
    templates,
    versions
  });
  const mediaIdsBySnapshot = new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      collectDynamicSnapshotMediaAssetIds(snapshot.snapshot_data_json)
    ])
  );
  for(const item of releaseItems){const config=sitesDynamicConfigurationSchema.safeParse(item.sites_configuration_json);if(item.dynamic_snapshot_id&&config.success&&config.data.background?.kind==="tenant"){const ids=mediaIdsBySnapshot.get(item.dynamic_snapshot_id)??[];ids.push(config.data.background.mediaAssetId);mediaIdsBySnapshot.set(item.dynamic_snapshot_id,ids);}}
  const mediaAssetIds = [
    ...new Set([...mediaIdsBySnapshot.values()].flat().concat(sourceWork.flatMap(work=>{
      const cfg=syncDynamicConfigurationSchema.safeParse(work.snapshot.snapshot_data_json.syncConfiguration);
      return cfg.success&&isRecord(work.live.data_json)?syncDynamicProjectionAssetIds(work.live.data_json,cfg.data):[];
    })))
  ];
  const assetsById = mediaAssetIds.length
    ? await loadDynamicTemplateAssets(admin, tenantId, mediaAssetIds)
    : new Map<string, PlayerDynamicTemplateAsset>();
  for(const work of sourceWork){
    const version=versions.find(value=>value.id===work.snapshot.template_version_id),template=version?templates.find(value=>value.id===version.template_id):null;
    if(!template)throw Error('SYNC_DYNAMIC_DATA_UNAVAILABLE');
    const cfg=syncDynamicConfigurationSchema.parse(work.snapshot.snapshot_data_json.syncConfiguration);
    const data=isRecord(work.live.data_json)?work.live.data_json:{};
    const assets=Object.fromEntries(syncDynamicProjectionAssetIds(data,cfg).flatMap(id=>assetsById.has(id)?[[id,assetsById.get(id)!]]:[]));
    syncDynamicSnapshots.set(work.itemId,projectSyncDynamicReleaseData({snapshot:work.snapshot,base:work.base,live:work.live,template,assets}));
  }
  for (const item of releaseItems) {
    if (!item.dynamic_snapshot_id) continue;
    const basePayload = payloads.get(item.dynamic_snapshot_id);
    const override=sitesDynamicConfigurationSchema.safeParse(item.sites_configuration_json);
    const payload=basePayload&&override.success?{...basePayload,data:{...basePayload.data,sitesConfiguration:override.data}}:basePayload;
    if (!payload) continue;
    const assets = Object.fromEntries(
      (mediaIdsBySnapshot.get(item.dynamic_snapshot_id) ?? []).flatMap(
        (assetId) => {
          const asset = assetsById.get(assetId);
          return asset ? [[assetId, asset]] : [];
        }
      )
    );
    const parsed = playerDynamicTemplatePayloadSchema.safeParse({
      ...payload,
      ...(Object.keys(assets).length ? { assets } : {})
    });
    if (parsed.success) result.set(item.id, parsed.data);
  }
  return result;
}

export function collectDynamicSnapshotMediaAssetIds(snapshot: unknown) {
  if (!isRecord(snapshot)) return [];
  const ids = new Set<string>();
  const sites=sitesDynamicConfigurationSchema.safeParse(snapshot.sitesConfiguration);if(sites.success&&sites.data.background?.kind==="tenant")ids.add(sites.data.background.mediaAssetId);
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  if (
    typeof brand?.logoMediaAssetId === "string" &&
    uuidPattern.test(brand.logoMediaAssetId)
  ) {
    ids.add(brand.logoMediaAssetId);
  }
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) {
    for (const value of menu.products.slice(0, 40)) {
      const product = isRecord(value) ? value : null;
      if (
        product &&
        typeof product.imageMediaAssetId === "string" &&
        uuidPattern.test(product.imageMediaAssetId)
      ) {
        ids.add(product.imageMediaAssetId);
      }
    }
  }
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    for (const sectionValue of priceList.sections.slice(0, 40)) {
      const section = isRecord(sectionValue) ? sectionValue : null;
      if (!Array.isArray(section?.products)) continue;
      for (const productValue of section.products.slice(0, 100)) {
        const product = isRecord(productValue) ? productValue : null;
        if (
          product?.photoVisible === true &&
          typeof product.imageMediaAssetId === "string" &&
          uuidPattern.test(product.imageMediaAssetId)
        ) {
          ids.add(product.imageMediaAssetId);
        }
      }
    }
  }
  const menuDocument = isRecord(snapshot.menuDocument)
    ? snapshot.menuDocument
    : null;
  if (Array.isArray(menuDocument?.assets)) {
    for (const value of menuDocument.assets.slice(0, 100)) {
      const asset = isRecord(value) ? value : null;
      if (
        typeof asset?.assetId === "string" &&
        uuidPattern.test(asset.assetId)
      ) {
        ids.add(asset.assetId);
      }
    }
  }
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  const arrivalConfig = isRecord(sport?.arrivalConfig) ? sport.arrivalConfig : null;
  if (
    arrivalConfig?.showSponsor === true &&
    typeof arrivalConfig.sponsorMediaAssetId === "string" &&
    uuidPattern.test(arrivalConfig.sponsorMediaAssetId)
  ) {
    ids.add(arrivalConfig.sponsorMediaAssetId);
  }
  if (Array.isArray(sport?.items)) {
    for (const value of sport.items.slice(0, 100)) {
      const item = isRecord(value) ? value : null;
      if (
        item &&
        typeof item.logoMediaAssetId === "string" &&
        uuidPattern.test(item.logoMediaAssetId)
      ) {
        ids.add(item.logoMediaAssetId);
      }
      if (
        item &&
        typeof item.photoMediaAssetId === "string" &&
        uuidPattern.test(item.photoMediaAssetId)
      ) {
        ids.add(item.photoMediaAssetId);
      }
      for (const key of ["homeLogoMediaAssetId", "awayLogoMediaAssetId"] as const) {
        if (typeof item?.[key] === "string" && uuidPattern.test(item[key])) {
          ids.add(item[key]);
        }
      }
    }
  }
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  if (!news) return [...ids];
  if (
    typeof news.providerLogoMediaAssetId === "string" &&
    uuidPattern.test(news.providerLogoMediaAssetId)
  ) {
    ids.add(news.providerLogoMediaAssetId);
  }
  if (Array.isArray(news.articles)) {
    for (const value of news.articles.slice(0, 50)) {
      const article = isRecord(value) ? value : null;
      if (
        article &&
        typeof article.heroMediaAssetId === "string" &&
        uuidPattern.test(article.heroMediaAssetId)
      ) {
        ids.add(article.heroMediaAssetId);
      }
      if (
        article &&
        typeof article.qrMediaAssetId === "string" &&
        uuidPattern.test(article.qrMediaAssetId)
      ) {
        ids.add(article.qrMediaAssetId);
      }
    }
  }
  return [...ids];
}

async function loadDynamicTemplateAssets(
  admin: ReturnType<typeof createPlayerAdminClient>,
  tenantId: string,
  mediaAssetIds: string[]
) {
  const assetResult = await admin
    .from("media_assets")
    .select("id, kind")
    .eq("tenant_id", tenantId)
    .eq("status", "ready")
    .in("id", mediaAssetIds);
  if (assetResult.error) return new Map<string, PlayerDynamicTemplateAsset>();
  const readyAssets = assetResult.data ?? [];
  const readyIds = readyAssets.map((asset) => asset.id);
  const kindById = new Map(readyAssets.map((asset) => [asset.id, asset.kind]));
  const missingIds = mediaAssetIds.filter((id) => !readyIds.includes(id));
  const [variantResult, providerResult] = await Promise.all([
    readyIds.length
      ? admin
          .from("media_variants")
          .select("asset_id, variant_type, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
          .eq("tenant_id", tenantId)
          .in("variant_type", ["original", "player_1080p", "thumbnail"])
          .in("asset_id", readyIds)
      : Promise.resolve({ data: [], error: null }),
    missingIds.length
      ? admin
          .from("provider_asset_versions")
          .select("id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
          .in("id", missingIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (variantResult.error || providerResult.error) {
    return new Map<string, PlayerDynamicTemplateAsset>();
  }
  const assets = new Map<string, PlayerDynamicTemplateAsset>();
  const variants = variantResult.data ?? [];
  await Promise.all(readyAssets.map(async (asset) => {
    const delivery = variants.find((variant) =>
      variant.asset_id === asset.id && variant.variant_type === (
        kindById.get(asset.id) === "video" ? "player_1080p" : "original"
      )
    );
    const poster = kindById.get(asset.id) === "video"
      ? variants.find((variant) =>
          variant.asset_id === asset.id && variant.variant_type === "thumbnail"
        )
      : null;
    if (!delivery || (kindById.get(asset.id) === "video" && !poster)) return;
    const [signed, signedPoster] = await Promise.all([
      admin.storage.from(delivery.storage_bucket)
        .createSignedUrl(delivery.storage_path, 60 * 60),
      poster
        ? admin.storage.from(poster.storage_bucket)
            .createSignedUrl(poster.storage_path, 60 * 60)
        : Promise.resolve({ data: null, error: null })
    ]);
    if (signed.error || !signed.data?.signedUrl ||
      (poster && (signedPoster.error || !signedPoster.data?.signedUrl))) return;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(delivery.file_size_bytes),
      checksumSha256: delivery.checksum_sha256,
      mimeType: delivery.mime_type,
      ...(poster ? {
        posterBytes: Number(poster.file_size_bytes),
        posterChecksumSha256: poster.checksum_sha256,
        posterMimeType: "image/png",
        posterUrl: signedPoster.data?.signedUrl
      } : {}),
      url: signed.data.signedUrl
    });
    if (parsed.success) assets.set(asset.id, parsed.data);
  }));
  await Promise.all((providerResult.data ?? []).map(async (provider) => {
    const signed = await admin.storage.from(provider.storage_bucket)
      .createSignedUrl(provider.storage_path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) return;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(provider.file_size_bytes),
      checksumSha256: provider.checksum_sha256,
      mimeType: provider.mime_type,
      url: signed.data.signedUrl
    });
    if (parsed.success) assets.set(provider.id, parsed.data);
  }));
  return assets;
}

function uniqueDynamicAssetBytes(
  templates: Map<string, PlayerDynamicTemplatePayload>
) {
  const assets = new Map<string, number>();
  for (const template of templates.values()) {
    for (const asset of Object.values(template.assets ?? {})) {
      assets.set(asset.checksumSha256, asset.bytes);
      if (asset.posterChecksumSha256 && asset.posterBytes) {
        assets.set(asset.posterChecksumSha256, asset.posterBytes);
      }
    }
  }
  return [...assets.values()].reduce((total, bytes) => total + bytes, 0);
}

function readPresentationDefaults(
  manifest: unknown
): PlayerManifestPresentationDefaults | null {
  if (!isRecord(manifest) || !isRecord(manifest.presentationDefaults)) {
    return null;
  }

  const defaults = manifest.presentationDefaults;
  if (
    !Number.isInteger(defaults.imageDurationSeconds) ||
    !["cut", "crossfade", "wipe"].includes(String(defaults.transition)) ||
    !["contain", "cover"].includes(String(defaults.fitMode)) ||
    typeof defaults.videoMuted !== "boolean" ||
    typeof defaults.loopEnabled !== "boolean"
  ) {
    return null;
  }

  const backgroundColor =
    typeof defaults.backgroundColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(defaults.backgroundColor)
      ? defaults.backgroundColor
      : undefined;

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    fitMode: defaults.fitMode as "contain" | "cover",
    imageDurationSeconds: defaults.imageDurationSeconds as number,
    loopEnabled: defaults.loopEnabled,
    transition: defaults.transition as PlayerManifestTransition,
    videoMuted: defaults.videoMuted
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
