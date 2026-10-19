import {beforeEach,expect,it,vi} from 'vitest';
import {syncSlidePresentationSchema,syncBackgroundAssets} from '@veyocast/contracts';
import {getCacheableAssets} from './player-cache';
const state=vi.hoisted(()=>({tables:[]as string[],configuration:null as unknown,rendered:null as unknown,live:null as unknown,binary:[]as unknown[]}));
const releaseId='10000000-0000-4000-8000-000000000227',tenantId='20000000-0000-4000-8000-000000000227',snapshotId='30000000-0000-4000-8000-000000000227';
vi.mock('./player-supabase',()=>({createPlayerAdminClient:()=>({
 rpc:async(name:string)=>{expect(name).toBe('get_sync_binary_playback_v1');return{data:state.binary,error:null};},
 from:(table:string)=>{
  state.tables.push(table);
  if(['media_assets','provider_asset_versions'].includes(table)||(['dynamic_template_versions','dynamic_templates'].includes(table)&&!state.live))throw Error('An unsupported Source DOM profile must not resolve a legacy template or live images');
  const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>({data:null,error:null}),
   single:async()=>({data:{id:releaseId,tenant_id:tenantId,playlist_id:'40000000-0000-4000-8000-000000000227',version:1,manifest_hash:'a'.repeat(64),manifest_json:{},published_at:'2026-10-18T12:00:00Z',total_bytes:100,total_duration_seconds:6},error:null}),
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null,data:table==='playlist_release_items'?[{
    id:'50000000-0000-4000-8000-000000000227',source_item_id:null,live_data_enabled:true,asset_kind:'video',asset_title:'Complete Source video',display_title:null,duration_seconds:6,fit_mode:'contain',muted:true,transition:'cut',crop_focus_x:0.5,crop_focus_y:0.5,background_color:null,volume_percent:100,trim_start_seconds:0,trim_end_seconds:null,visible_from:null,visible_until:null,enabled:true,accessibility_name:null,section_source_id:null,storage_bucket:'tenant-media',storage_path:'frozen/complete-source.mp4',mime_type:'video/mp4',file_size_bytes:100,checksum_sha256:'b'.repeat(64),dynamic_snapshot_id:snapshotId,youtube_video_id:null,sites_configuration_json:null,sites_studio_presentation_json:null,sync_studio_presentation_json:null,sync_studio_duration_ms:null,engage_public_id:null,
   }]:table==='dynamic_slide_snapshots'?[{id:snapshotId,template_version_id:'60000000-0000-4000-8000-000000000227',dynamic_slide_version_id:'70000000-0000-4000-8000-000000000227',source_revision_hash:'c'.repeat(64),status:'ready',sync_render_result_json:state.rendered,snapshot_data_json:{type:'menu',syncConfiguration:state.configuration,menu:{products:[]}}}]:table==='published_dynamic_data'?(state.live?[state.live]:[]):table==='dynamic_template_versions'?[{id:'60000000-0000-4000-8000-000000000227',template_id:'61000000-0000-4000-8000-000000000227'}]:table==='dynamic_templates'?[{id:'61000000-0000-4000-8000-000000000227',slug:'actual-registered-menu',slide_type:'menu',orientation:'landscape'}]:[]}).then(resolve)};
  return query;
 },storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://media.example/frozen/complete-source.mp4'},error:null})})},
})}));
import {loadPlayerReleaseEnvelope} from './player-release-envelope';
const input={releaseId,tenantId,device:{id:'80000000-0000-4000-8000-000000000227',screenId:'90000000-0000-4000-8000-000000000227',screenName:'Own screen',activeReleaseId:releaseId,desiredReleaseId:releaseId}};
beforeEach(()=>{state.tables=[];state.live=null;state.binary=[];const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'menu',orientation:'landscape',theme:'fieldflow',name:'Eigen menu',title:'Eigen producten',club:{name:'Club A'},style:{motion:'geen'}});state.configuration={schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'menu',secondsPerPage:3,seed};state.rendered={mimeType:'video/mp4',byteLength:100,checksumSha256:'b'.repeat(64),durationMs:6000,presentation:{...seed,rows:Array.from({length:5},(_,i)=>[`Product ${i+1}`,'€ 2,50','',''])}};});
it.each([false,true])('keeps the complete Source binary when only the existing Studio capability is %s',async(enableSyncStudio)=>{
 const value=await loadPlayerReleaseEnvelope({...input,enableSyncStudio});
 expect(value.manifest.items[0]).toMatchObject({kind:'video',durationSeconds:6,source:{bytes:100,checksumSha256:'b'.repeat(64),mimeType:'video/mp4',url:'https://media.example/frozen/complete-source.mp4'}});
 expect(value.manifest.items[0]!.dynamicTemplate).toBeUndefined();expect(value.manifest.items[0]!.syncStudioPresentation).toBeUndefined();expect(value.manifest.items[0]!.sitesPresentation).toBeUndefined();expect(value.manifest.systemAssets).toBeUndefined();expect(value.manifest.syncSystemAssets).toBeUndefined();expect(value.manifest.totalBytes).toBe(100);
 expect(state.tables).toEqual(expect.arrayContaining(['dynamic_slide_snapshots','playlist_release_items']));
});

it('offers the independent complete Source presentation and eleven assets only to the DOM profile',async()=>{
 const value=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'}),item=value.manifest.items[0]!;
 expect(item.syncDynamic?.presentation.rows).toHaveLength(5);expect(item.syncDynamic).toMatchObject({configurationSnapshotId:snapshotId,snapshotId,templateVersionId:'60000000-0000-4000-8000-000000000227',fallbackChecksumSha256:item.source.checksumSha256,durationMs:6000});expect(item.dynamicTemplate).toBeUndefined();expect(item.syncStudioPresentation).toBeUndefined();expect(item.syncDynamicBinary).toBeUndefined();expect(value.manifest.syncSystemAssets).toHaveLength(11);expect(getCacheableAssets(value.manifest)).toHaveLength(12);
});
it('offers current data identity without DOM, fonts or private image work to the new binary profile',async()=>{
 const value=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'}),item=value.manifest.items[0]!;
 expect(item.syncDynamicBinary).toMatchObject({configurationSnapshotId:snapshotId,durationMs:6000,contentHash:'c'.repeat(64),fallbackChecksumSha256:item.source.checksumSha256});expect(item.syncDynamic).toBeUndefined();expect(value.manifest.syncSystemAssets).toBeUndefined();expect(getCacheableAssets(value.manifest)).toHaveLength(1);
});
it.each(['dom','binary']as const)('does not pair Source %s metadata with a different complete fallback',async(syncDynamicMode)=>{
 state.rendered={...(state.rendered as Record<string,unknown>),checksumSha256:'f'.repeat(64)};await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode})).rejects.toThrow('SYNC_DYNAMIC_RELEASE_INVALID');expect((await loadPlayerReleaseEnvelope(input)).manifest.items[0]!.source.checksumSha256).toBe('b'.repeat(64));
});

it('refreshes every Source data row from its frozen authorized definition without changing the complete published fallback',async()=>{
 const original=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'});
 state.live={snapshot_id:snapshotId,content_hash:'e'.repeat(64),data_revision:2,data_json:{type:'menu',syncConfiguration:state.configuration,menu:{products:Array.from({length:9},(_,i)=>({id:`actual-product-${i}`,name:`Actueel product ${i+1}`,category:'Eigen kaart',priceMinor:325+i}))}}};
 const fresh=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'}),item=fresh.manifest.items[0]!;
 expect(item.syncDynamic?.presentation.rows).toHaveLength(9);expect(item.syncDynamic?.presentation.rows[0]?.[1]).toContain('3,25');expect(item.syncDynamic?.durationMs).toBe(9000);expect(item.syncDynamic?.dataRevision).toBe(2);expect(item.syncDynamic?.configurationHash).toBe(original.manifest.items[0]!.syncDynamic?.configurationHash);expect(item.syncDynamic?.contentHash).toBe('e'.repeat(64));expect(item.source).toEqual(original.manifest.items[0]!.source);expect(item.syncStudioPresentation).toBeUndefined();expect(getCacheableAssets(fresh.manifest)).toHaveLength(12);
 const binary=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'});expect(binary.manifest.items[0]!.syncDynamicBinary?.contentHash).toBe('c'.repeat(64));expect(binary.manifest.items[0]!.source).toEqual(original.manifest.items[0]!.source);
});
it('refuses data that changes the immutable Source design instead of replacing a validated local dataset',async()=>{
 const configuration=structuredClone(state.configuration)as {seed:{theme:string}};configuration.seed.theme='onzetrots-tv';state.live={snapshot_id:snapshotId,content_hash:'e'.repeat(64),data_revision:2,data_json:{type:'menu',syncConfiguration:configuration,menu:{products:[]}}};await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'})).rejects.toThrow('SYNC_DYNAMIC_DATA_INVALID');
});

function readyBinary(){
 const cfg=state.configuration as {seed:Record<string,unknown>},slot='40000000-0000-4000-8000-000000000228',prefix=`tenants/${tenantId}/assets/${slot}/sync-dynamic/`;
 return{snapshotId,contentHash:'d'.repeat(64),dataRevision:3,artifact:{presentation:{...cfg.seed,rows:Array.from({length:9},(_,i)=>[`Actueel product ${i+1}`,'€ 4,95','',''])},width:1920,height:1080,mimeType:'video/mp4',byteLength:250,checksumSha256:'e'.repeat(64),durationMs:9000,storagePath:prefix+'e'.repeat(64)+'.mp4',poster:{byteLength:50,checksumSha256:'f'.repeat(64),storagePath:prefix+'f'.repeat(64)+'.png'}}};
}
it('delivers every freshly rendered binary page with separate data identity while preserving the old and DOM fallback',async()=>{
 state.binary=[readyBinary()];const fresh=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'}),item=fresh.manifest.items[0]!;
 expect(item.source).toMatchObject({bytes:250,checksumSha256:'e'.repeat(64),mimeType:'video/mp4'});expect(item.durationSeconds).toBe(9);expect(item.syncDynamicBinary).toMatchObject({configurationSnapshotId:snapshotId,contentHash:'d'.repeat(64),dataRevision:3,durationMs:9000,fallbackChecksumSha256:'e'.repeat(64)});expect(item.dynamicTemplate).toBeUndefined();expect(fresh.manifest.totalBytes).toBe(250);expect(fresh.manifest.totalDurationSeconds).toBe(9);expect(getCacheableAssets(fresh.manifest)).toHaveLength(1);
 for(const mode of[false,'dom']as const){const old=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:mode});expect(old.manifest.items[0]!.source.checksumSha256).toBe('b'.repeat(64));expect(old.manifest.items[0]!.durationSeconds).toBe(6);}
});
it('rejects a cache artifact from another tenant or configuration rather than accepting its signed delivery',async()=>{
 const value=readyBinary();state.binary=[{...value,artifact:{...value.artifact,storagePath:value.artifact.storagePath.replace(tenantId,'90000000-0000-4000-8000-000000000228')}}];await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).rejects.toThrow('SYNC_DYNAMIC_BINARY_INVALID');
 state.binary=[{...value,snapshotId:'90000000-0000-4000-8000-000000000228'}];await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).rejects.toThrow('SYNC_DYNAMIC_BINARY_INVALID');
});
it('rejects a truncated binary sequence and duplicate cache bindings',async()=>{
 const value=readyBinary();state.binary=[{...value,artifact:{...value.artifact,durationMs:6000}}];await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).rejects.toThrow('SYNC_DYNAMIC_BINARY_INVALID');
 state.binary=[value,value];await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).rejects.toThrow('SYNC_DYNAMIC_BINARY_UNAVAILABLE');
});
it('accepts fenced refresh filenames and rejects a poster from a different attempt',async()=>{
 const value=readyBinary(),lease='70000000-0000-4000-8000-000000000228-';
 value.artifact.storagePath=value.artifact.storagePath.replace('/sync-dynamic/','/sync-dynamic/'+lease);
 value.artifact.poster.storagePath=value.artifact.poster.storagePath.replace('/sync-dynamic/','/sync-dynamic/'+lease);
 state.binary=[value];expect((await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).manifest.items[0]!.source.checksumSha256).toBe('e'.repeat(64));
 value.artifact.poster.storagePath=value.artifact.poster.storagePath.replace(lease,'80000000-0000-4000-8000-000000000228-');
 await expect(loadPlayerReleaseEnvelope({...input,syncDynamicMode:'binary'})).rejects.toThrow('SYNC_DYNAMIC_BINARY_INVALID');
});


function addApprovedScene() {
 const cfg = state.configuration as { seed: ReturnType<typeof syncSlidePresentationSchema.parse> }, asset = syncBackgroundAssets[0]!;
 cfg.seed.style = { ...cfg.seed.style, background: 'photo', backgroundAsset: { kind: 'system', path: asset.path, checksumSha256: asset.sha256 } };
 const rendered = state.rendered as { presentation: ReturnType<typeof syncSlidePresentationSchema.parse> };
 rendered.presentation.style = structuredClone(cfg.seed.style);
 return asset;
}
it('only negotiates selected scene assets with the explicit backgrounds capability',async()=>{
 const asset=addApprovedScene();
 const old=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'});
 expect(old.manifest.items[0]!.syncDynamic).toBeUndefined();expect(old.manifest.items[0]!.syncDynamicBinary).toBeDefined();expect(old.manifest.syncSystemAssets).toBeUndefined();expect(getCacheableAssets(old.manifest)).toHaveLength(1);
 const fresh=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom',enableSyncBackgrounds:true});
 expect(fresh.manifest.syncSystemAssets).toHaveLength(12);expect(fresh.manifest.syncSystemAssets!.at(-1)?.checksumSha256).toBe(asset.sha256);expect(fresh.manifest.items[0]!.syncDynamic?.presentation.style.backgroundAsset).toEqual((state.configuration as {seed:{style:{backgroundAsset:unknown}}}).seed.style.backgroundAsset);expect(fresh.manifest.items[0]!.syncDynamicBinary).toBeUndefined();expect(getCacheableAssets(fresh.manifest)).toHaveLength(13);
 expect(fresh.manifest.items[0]!.source).toEqual(old.manifest.items[0]!.source);
});
it('keeps frozen scene selection during real canonical live-data projection and gives older clients the complete fresh binary',async()=>{
 addApprovedScene();const original=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom',enableSyncBackgrounds:true});
 state.live={snapshot_id:snapshotId,content_hash:'e'.repeat(64),data_revision:2,data_json:{type:'menu',syncConfiguration:state.configuration,menu:{products:[{id:'actual-product',name:'Actuele prijs',category:'Eigen kaart',priceMinor:495}]}}};
 const fresh=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom',enableSyncBackgrounds:true});
 expect(fresh.manifest.items[0]!.syncDynamic?.presentation.rows[0]?.[0]).toBe('Actuele prijs');expect(fresh.manifest.items[0]!.syncDynamic?.presentation.style).toEqual(original.manifest.items[0]!.syncDynamic!.presentation.style);expect(fresh.manifest.items[0]!.syncDynamic?.dataRevision).toBe(2);
 state.binary=[readyBinary()];const old=await loadPlayerReleaseEnvelope({...input,syncDynamicMode:'dom'});expect(old.manifest.items[0]!.source.checksumSha256).toBe('e'.repeat(64));expect(old.manifest.items[0]!.syncDynamicBinary?.dataRevision).toBe(3);expect(old.manifest.syncSystemAssets).toBeUndefined();expect(getCacheableAssets(old.manifest)).toHaveLength(1);
});
