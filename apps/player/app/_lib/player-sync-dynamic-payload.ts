import {collectSyncSportMediaAssetIds} from '@veyocast/contracts';
import {createHash} from 'node:crypto';
import {readSyncDynamicDomArtifact,syncDynamicDomMetadataSchema,syncDynamicConfigurationSchema,syncDynamicBinaryPlaybackSchema,syncSlidePageCount,syncSlideDurationMs,syncSlideInternalMotion,syncSlidePresentationSchema,syncSlideAssets,type SyncDynamicBinaryPlayback,type SyncDynamicConfiguration,type PlayerDynamicTemplateAsset,type SyncDynamicDomMetadata,type SyncSlidePresentation} from '@veyocast/contracts';
import {projectSyncDynamicSnapshot} from '@veyocast/content-templates/sync-dynamic-projector';
import type {DynamicSnapshotPayloadRow} from './player-dynamic-template-payload';
import {parseLedScoresLiveMatchConfig} from './ledscores-match-experience';

export type SyncDynamicSnapshotRow=DynamicSnapshotPayloadRow&{status?:string;dynamic_slide_version_id:string;sync_render_result_json?:unknown};
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

/** The device's existing authorized global stream owns live state. This small
 * binding contains no provider endpoint or unchecked image URL. */
function readSyncLiveMatch(data:Record<string,unknown>,cfg:SyncDynamicConfiguration){
 if(cfg.slideType!=='ledscores_live_match')return undefined;
 const config=parseLedScoresLiveMatchConfig(data);
 if(!config)throw Error('SYNC_DYNAMIC_MATCH_BINDING_INVALID');
 const state=config.fallbackState;
 return{connectionId:config.connectionId,showClock:config.showClock,
  ...(state&&!state.matchKey.startsWith('waiting:')?{sourceUpdatedAt:state.sourceUpdatedAt}:{})};
}

/** An authorized immutable snapshot and the exact complete binary from the
 * release must agree before the independent Source enhancement is offered. */
export type SyncDynamicReleaseBase={presentation:SyncSlidePresentation;configuration:SyncDynamicConfiguration;metadata:SyncDynamicBinaryPlayback|SyncDynamicDomMetadata;liveMatch:ReturnType<typeof readSyncLiveMatch>};
export function readSyncDynamicReleaseSnapshot(snapshot:SyncDynamicSnapshotRow,item:{checksum_sha256:string;file_size_bytes:number;mime_type:string;asset_kind:string;duration_seconds:number;storage_path?:string},allowDomV2=false):SyncDynamicReleaseBase{
 const cfg=syncDynamicConfigurationSchema.safeParse(snapshot.snapshot_data_json.syncConfiguration),result=snapshot.sync_render_result_json;
 if(!cfg.success||snapshot.status!=='ready'||!record(result))throw Error('SYNC_DYNAMIC_RELEASE_INVALID');
 if(result.schemaVersion===2){
  const checked=readSyncDynamicDomArtifact(cfg.data,result);
  if(!allowDomV2||snapshot.snapshot_data_json.syncPlaybackProtocol!==2||!checked||item.asset_kind!=='composition'||item.mime_type!==checked.artifact.mimeType||item.checksum_sha256!==checked.artifact.checksumSha256||Number(item.file_size_bytes)!==checked.artifact.byteLength||item.storage_path!==checked.artifact.storagePath||item.duration_seconds*1000<checked.artifact.durationMs)throw Error('SYNC_DYNAMIC_DOM_RELEASE_INVALID');
  return {presentation:checked.artifact.presentation,configuration:cfg.data,metadata:syncDynamicDomMetadataSchema.parse({schemaVersion:2,configurationSnapshotId:snapshot.id,snapshotId:snapshot.id,templateVersionId:snapshot.template_version_id,configurationHash:createHash('sha256').update(JSON.stringify(['sync-dom-v2',snapshot.dynamic_slide_version_id,snapshot.template_version_id,cfg.data])).digest('hex'),contentHash:snapshot.source_revision_hash,descriptorChecksumSha256:item.checksum_sha256,durationMs:checked.artifact.durationMs,dataRevision:1}),liveMatch:readSyncLiveMatch(snapshot.snapshot_data_json,cfg.data)};
 }

 const presentation=syncSlidePresentationSchema.safeParse(result.presentation);
 if(!presentation.success)throw Error('SYNC_DYNAMIC_RELEASE_INVALID');
 const value=presentation.data,pages=syncSlidePageCount(value),video=pages>1||syncSlideInternalMotion(value).enabled||value.style.motion==='rustig'||value.style.motion==='dynamisch';
 if(result.checksumSha256!==item.checksum_sha256||Number(result.byteLength)!==Number(item.file_size_bytes)||result.mimeType!==item.mime_type||item.mime_type!==(video?'video/mp4':'image/png')||item.asset_kind!==(video?'video':'image')||value.rendererVersion!==cfg.data.rendererVersion||value.sourceRevision!==cfg.data.sourceRevision||value.orientation!==cfg.data.seed.orientation||value.family!==cfg.data.seed.family||value.theme!==cfg.data.seed.theme||result.durationMs!==syncSlideDurationMs(value,cfg.data.secondsPerPage)||Number(result.durationMs)>Number(item.duration_seconds)*1000)throw Error('SYNC_DYNAMIC_RELEASE_INVALID');
 const metadata:SyncDynamicBinaryPlayback={schemaVersion:1,configurationSnapshotId:snapshot.id,snapshotId:snapshot.id,templateVersionId:snapshot.template_version_id,configurationHash:createHash('sha256').update(JSON.stringify([snapshot.dynamic_slide_version_id,snapshot.template_version_id,cfg.data])).digest('hex'),contentHash:snapshot.source_revision_hash,fallbackChecksumSha256:item.checksum_sha256,durationMs:Number(result.durationMs)};
 return {presentation:value,configuration:cfg.data,metadata:syncDynamicBinaryPlaybackSchema.parse(metadata),liveMatch:readSyncLiveMatch(snapshot.snapshot_data_json,cfg.data)};
}

export function syncDynamicProjectionAssetIds(data:Record<string,unknown>,cfg:SyncDynamicConfiguration){
 const ids=new Set(syncSlideAssets(cfg.seed).flatMap(ref=>ref.kind==='tenant'?[ref.mediaAssetId]:[]));
 const add=(value:unknown)=>{if(typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))ids.add(value);};
 if(record(data.brand))add(data.brand.logoMediaAssetId);
 if(['sport_match_of_the_day','sport_next_match'].includes(cfg.slideType)&&record(data.sport)&&Array.isArray(data.sport.items))for(const item of data.sport.items.slice(0,1))if(record(item)){add(item.homeLogoMediaAssetId);add(item.awayLogoMediaAssetId);}
 for(const id of collectSyncSportMediaAssetIds(data))add(id);
 return [...ids];
}

/** Existing published-data rows, already projected from the exact immutable
 * definition, supply facts. The original complete binary remains last-known-
 * good when the independent DOM profile or a live dataset is unavailable. */
export function projectSyncDynamicReleaseData({snapshot,live,base,template,assets,now=new Date()}:{snapshot:SyncDynamicSnapshotRow;live:{data_json:unknown;content_hash:unknown;data_revision:unknown};base:ReturnType<typeof readSyncDynamicReleaseSnapshot>;template:{slug:string;slide_type:string;orientation:string};assets:Record<string,PlayerDynamicTemplateAsset>;now?:Date}){
 const cfg=syncDynamicConfigurationSchema.safeParse(snapshot.snapshot_data_json.syncConfiguration),data=live.data_json;
 const liveCfg=record(data)?syncDynamicConfigurationSchema.safeParse(data.syncConfiguration):null;
 if(!cfg.success||!record(data)||!liveCfg?.success||JSON.stringify(liveCfg.data)!==JSON.stringify(cfg.data)||template.slide_type!==cfg.data.slideType||template.orientation!==cfg.data.seed.orientation||!Number.isSafeInteger(Number(live.data_revision))||Number(live.data_revision)<1)throw Error('SYNC_DYNAMIC_DATA_INVALID');
 const result=projectSyncDynamicSnapshot({schemaVersion:1,snapshotId:snapshot.id,snapshotHash:live.content_hash,templateVersionId:snapshot.template_version_id,templateSlug:template.slug,orientation:template.orientation,slideType:template.slide_type,data,assets},cfg.data.seed,now);
 if(!result.ok)throw Error('SYNC_DYNAMIC_DATA_INVALID');
 const durationMs=syncSlideDurationMs(result.presentation,cfg.data.secondsPerPage);
 if(durationMs>120000)throw Error('SYNC_DYNAMIC_DATA_INVALID');
 return {presentation:result.presentation,configuration:cfg.data,metadata:(base.metadata.schemaVersion===2?syncDynamicDomMetadataSchema:syncDynamicBinaryPlaybackSchema).parse({...base.metadata,durationMs,contentHash:live.content_hash,dataRevision:Number(live.data_revision)}),liveMatch:readSyncLiveMatch(data,cfg.data)};
}
