import {readSyncDynamicArtifact,syncSlideAssets,type PlayerDynamicTemplateAsset} from '@veyocast/contracts';
import type {SyncDynamicLibraryDesign} from './_components/sites/model';

export type PublisherSyncSnapshot={id:string;dynamic_slide_id:string;dynamic_slide_version_id?:string;template_version_id:string;source_revision_hash:string;snapshot_data_json:unknown;output_media_asset_id?:string|null;status?:string;sync_render_result_json?:unknown};
export type PublisherSyncMedia={id:string;status:string;kind:string;mime_type:string;checksum_sha256:string|null;file_size_bytes:number;duration_seconds:number|null;width:number|null;height:number|null};

/** Only a ready, authorized frozen snapshot and its registered complete media
 * can enter the independent Source picker/placement model. No legacy template
 * configuration or guessed slug is constructed for connected Source content. */
export function readPublisherSyncDynamic({snapshot,definition,assets,media}:{snapshot:PublisherSyncSnapshot;definition:{id:string;name:string};assets:Record<string,PlayerDynamicTemplateAsset>;media:PublisherSyncMedia|undefined}):SyncDynamicLibraryDesign{
 const data=snapshot.snapshot_data_json as {syncConfiguration?:unknown}|null;
 const checked=readSyncDynamicArtifact(data?.syncConfiguration,snapshot.sync_render_result_json);
 if(!checked||snapshot.status!=='ready'||snapshot.dynamic_slide_id!==definition.id||!uuid.test(snapshot.id)||!uuid.test(snapshot.template_version_id)||!snapshot.dynamic_slide_version_id||!uuid.test(snapshot.dynamic_slide_version_id)||!media||media.id!==snapshot.output_media_asset_id||media.status!=='ready')throw Error('Het gekoppelde Source-ontwerp heeft nog geen volledig gecontroleerde uitvoer. Open het bronontwerp en kies een gereedstaande versie.');
 const {artifact,configuration}=checked,kind=artifact.mimeType==='video/mp4'?'video':'image';
 if(media.kind!==kind||media.mime_type!==artifact.mimeType||media.checksum_sha256!==artifact.checksumSha256||Number(media.file_size_bytes)!==artifact.byteLength||media.width!==artifact.width||media.height!==artifact.height||kind==='video'&&Number(media.duration_seconds)*1000!==artifact.durationMs)throw Error('De volledige Source-uitvoer hoort niet bij deze snapshot. Selecteer een gecontroleerde versie opnieuw.');
 const urls:Record<string,string>={};
 for(const ref of syncSlideAssets(artifact.presentation)){
  if(ref.kind!=='tenant')continue;const asset=assets[ref.mediaAssetId];
  if(!asset||asset.checksumSha256!==ref.checksumSha256||!asset.mimeType.startsWith('image/'))throw Error('Een privébeeld van dit Source-ontwerp kon niet worden gecontroleerd. De opgeslagen inhoud blijft behouden; vernieuw de bibliotheek.');
  urls[ref.mediaAssetId]=asset.url;
 }
 return{id:definition.id,name:definition.name,snapshotId:snapshot.id,versionId:snapshot.dynamic_slide_version_id,templateVersionId:snapshot.template_version_id,configuration,presentation:artifact.presentation,assetUrls:urls,durationSeconds:artifact.durationMs/1000,mediaAssetId:media.id,checksumSha256:artifact.checksumSha256,kind,provider:configuration.slideType==='news'?'news':configuration.slideType==='ledscores_live_match'?'led-scores':['menu','price_list'].includes(configuration.slideType)?'menu':'sportlink'};
}
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
