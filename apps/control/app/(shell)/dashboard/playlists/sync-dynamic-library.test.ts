import {describe,it,expect} from 'vitest';
import {createSyncStudioStarter} from '@veyocast/studio';
import {readPublisherSyncDynamic,type PublisherSyncSnapshot,type PublisherSyncMedia} from './sync-dynamic-library';
import {planPlaylistChanges,playlistPlacementPages,minimumPlaylistPlacementSeconds} from './_components/sites/playlist-command-plan';
import type {Playlist,Slide} from './_components/sites/model';

const id=(n:number)=>`10000000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
function fixture(){
 const seed=createSyncStudioStarter({family:'menu',tenantName:'Eigen club'}).syncPresentation!,presentation={...seed,rows:Array.from({length:9},(_,i)=>[`Eigen product ${i+1}`,'€ 2,50','','']as[string,string,string,string])};
 const configuration={schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'menu',seed,secondsPerPage:5};
 const media:PublisherSyncMedia={id:id(4),status:'ready',kind:'video',mime_type:'video/mp4',checksum_sha256:'a'.repeat(64),file_size_bytes:12345,duration_seconds:15,width:1920,height:1080};
 const snapshot:PublisherSyncSnapshot={id:id(2),dynamic_slide_id:id(1),dynamic_slide_version_id:id(3),template_version_id:id(5),source_revision_hash:'b'.repeat(64),status:'ready',output_media_asset_id:media.id,snapshot_data_json:{type:'menu',syncConfiguration:configuration},sync_render_result_json:{presentation,width:1920,height:1080,mimeType:'video/mp4',byteLength:12345,durationMs:15000,storagePath:'tenants/own/assets/source.mp4',checksumSha256:media.checksum_sha256,poster:{byteLength:100,storagePath:'tenants/own/assets/poster.png',checksumSha256:'c'.repeat(64)}}};
 return{snapshot,media,definition:{id:id(1),name:'Eigen gekoppeld menu'},assets:{}};
}
describe('independent Source library and pinned placement authority',()=>{
 it('publishes the complete approved standings cycle even when the author requested five seconds',()=>{
  const input=fixture(),seed=createSyncStudioStarter({family:'standings',tenantName:'Eigen club',theme:'onzetrots-tv'}).syncPresentation!;
  const presentation={...seed,rich:{standings:{ownTeamId:null,rows:Array.from({length:14},(_,i)=>({id:`standing-${i}`,teamId:`team-${i}`,clubId:null,teamName:`Gecontroleerd team ${i}`,position:i+1,played:null,won:null,drawn:null,lost:null,goalDifference:null,points:null,form:[]}))}}};
  input.snapshot.snapshot_data_json={type:'sport_standing',syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'sport_standing',seed,secondsPerPage:5}};
  input.snapshot.sync_render_result_json={...(input.snapshot.sync_render_result_json as Record<string,unknown>),presentation,durationMs:38000};input.media.duration_seconds=38;
  const source=readPublisherSyncDynamic(input),slide:Slide={id:id(91),name:source.name,image:'',seconds:source.durationSeconds/playlistPlacementPages({id:id(91),name:source.name,image:'',seconds:5,syncDynamic:source}),syncDynamic:source,mediaId:source.mediaAssetId};
  const empty:Playlist={id:id(92),name:'Gecontroleerde playlist',description:'',status:'Concept',updated:'',slides:[]};
  expect(source.configuration.secondsPerPage).toBe(5);expect(minimumPlaylistPlacementSeconds(slide)).toBe(38);expect(slide.seconds).toBe(38);
  expect(planPlaylistChanges(empty,{...empty,slides:[slide]},new Map([[slide.id,slide]]))[0]).toMatchObject({operation:'add_sync_dynamic',durationSeconds:38,snapshotId:source.snapshotId});
  expect(()=>planPlaylistChanges(empty,{...empty,slides:[{...slide,seconds:5}]},new Map([[slide.id,slide]]))).toThrow('volledige afspeeluitvoer');
 });
 it('keeps an existing YouTube source while replacing only the placement fallback with the verified Source export',()=>{
  const presentation=createSyncStudioStarter({family:'youtube',tenantName:'Eigen club'}).syncPresentation!;
  const slide:Slide={id:id(80),name:'Eigen videokaart',image:'',seconds:5,mediaId:id(81),fallbackAssetId:id(81),sourceKind:'youtube',sourceId:id(82),syncStudio:{id:id(83),name:'Eigen videokaart',draftRevision:1,presentation,assetUrls:{},durationSeconds:5,exportKind:'video',exportAssetId:id(81),checksumSha256:'a'.repeat(64)}};
  const original:Playlist={id:id(84),name:'Eigen playlist',description:'',status:'Concept',updated:'',slides:[]};
  const operations=planPlaylistChanges(original,{...original,slides:[slide]},new Map([[slide.id,slide]]));
  expect(operations.slice(0,2)).toEqual([{operation:'add_youtube',clientId:slide.id,sourceId:id(82),durationSeconds:5},{operation:'replace_fallback',itemId:slide.id,mediaAssetId:id(81),sourceKind:'youtube',sourceId:id(82)}]);
  expect(operations.some(operation=>operation.operation==='add_media')).toBe(false);
 });
 it('retains the real snapshot/version/media identity and all frozen Source pages',()=>{
  const value=readPublisherSyncDynamic(fixture());expect(value).toMatchObject({id:id(1),snapshotId:id(2),versionId:id(3),templateVersionId:id(5),mediaAssetId:id(4),durationSeconds:15,kind:'video'});expect(value.presentation.rows).toHaveLength(9);expect(value).not.toHaveProperty('sitesConfiguration');
 });
 it('rejects mismatching, incomplete or cross-definition artifacts',()=>{
  const value=fixture();expect(()=>readPublisherSyncDynamic({...value,media:{...value.media,checksum_sha256:'d'.repeat(64)}})).toThrow('uitvoer');
  expect(()=>readPublisherSyncDynamic({...value,definition:{id:id(10),name:'Other'}})).toThrow('ontwerp');
  expect(()=>readPublisherSyncDynamic({...value,snapshot:{...value.snapshot,sync_render_result_json:{}}})).toThrow('ontwerp');
 });
 it('requires checksum-bound images from the already authorized snapshot',()=>{
  const value=fixture(),result=value.snapshot.sync_render_result_json as Record<string,unknown>;
  const presentation=structuredClone(result.presentation)as ReturnType<typeof createSyncStudioStarter>['syncPresentation'];
  presentation!.club.logo={kind:'tenant',mediaAssetId:id(8),checksumSha256:'e'.repeat(64)};
  value.snapshot.sync_render_result_json={...result,presentation};expect(()=>readPublisherSyncDynamic(value)).toThrow('privébeeld');
 });
 it('adds one complete dynamic placement with no synthetic Sites patch or Media-only provenance',()=>{
  const value=readPublisherSyncDynamic(fixture());const slide:Slide={id:id(20),name:value.name,image:'',seconds:5,syncDynamic:value,designId:value.id,mediaId:value.mediaAssetId,kind:value.kind};
  const original:Playlist={id:id(30),name:'Own playlist',description:'',status:'Concept',updated:'',slides:[]};
  expect(playlistPlacementPages(slide)).toBe(3);
  const operations=planPlaylistChanges(original,{...original,slides:[slide]},new Map([[slide.id,slide]]));
  expect(operations[0]).toEqual({operation:'add_sync_dynamic',clientId:slide.id,dynamicSlideId:value.id,expectedSnapshotId:value.snapshotId,snapshotId:value.snapshotId,durationSeconds:15});
  expect(JSON.stringify(operations)).not.toContain('sitesConfiguration');expect(operations.some(value=>value.operation==='add_media')).toBe(false);
  expect(()=>planPlaylistChanges(original,{...original,slides:[{...slide,themeId:'onzetrots-tv'}]},new Map([[slide.id,slide]]))).toThrow('volledige afspeeluitvoer');
  expect(()=>planPlaylistChanges(original,{...original,slides:[{...slide,seconds:7}]},new Map([[slide.id,slide]]))).toThrow('volledige afspeeluitvoer');
 });
 it('binds a verified placement variant atomically after the selected base add and preserves it on copies',()=>{
  const source=readPublisherSyncDynamic(fixture());
  const design={...source,snapshotId:id(50),mediaAssetId:id(51),durationSeconds:21,placementVariantBaseSnapshotId:source.snapshotId,configuration:{...source.configuration,secondsPerPage:7},presentation:{...source.presentation,theme:'onzetrots-tv' as const}};
  const base:Slide={id:id(20),name:source.name,image:'',seconds:5,syncDynamic:source,mediaId:source.mediaAssetId};
  const themed:Slide={...base,seconds:7,syncDynamic:design,mediaId:design.mediaAssetId};
  const empty:Playlist={id:id(30),name:'Own playlist',description:'',status:'Concept',updated:'',slides:[]};
  const added=planPlaylistChanges(empty,{...empty,slides:[themed]},new Map([[base.id,base]]));
  expect(added[0]).toEqual({operation:'add_sync_dynamic',clientId:base.id,dynamicSlideId:source.id,expectedSnapshotId:source.snapshotId,snapshotId:id(50),durationSeconds:21});
  const before={...empty,slides:[base]},after={...empty,slides:[themed]};
  expect(planPlaylistChanges(before,after,new Map())[0]).toEqual({operation:'use_sync_dynamic_variant',itemId:base.id,expectedSnapshotId:source.snapshotId,snapshotId:id(50),durationSeconds:21});
  const copy={...themed,id:id(21),duplicateOf:themed.id};
  const copied=planPlaylistChanges(after,{...after,slides:[themed,copy]},new Map([[copy.id,copy]]));
  expect(copied.filter(operation=>operation.operation==='use_sync_dynamic_variant')).toEqual([]);
  expect(copied[0]).toEqual({operation:'duplicate',clientId:copy.id,itemId:themed.id});
  expect(planPlaylistChanges(after,after,new Map())).toEqual([]);
 });
});
