import {beforeEach,expect,it,vi}from'vitest';
import {syncDynamicConfigurationSchema,type PlayerDynamicTemplateAsset}from'@veyocast/contracts';
import {createSyncStudioStarter}from'../../../../packages/studio/src/sync';
import {sourceRefreshDescriptorFixture}from'../../../../tests/helpers/source-refresh-fixture';
import {loadPlayerReleaseEnvelope}from'./player-release-envelope';
import {syncDynamicProjectionAssetIds}from'./player-sync-dynamic-payload';
import {getCacheableAssets}from'./player-cache';

const db=vi.hoisted(()=>({rows:{}as Record<string,unknown[]>,requested:{}as Record<string,string[]>,signed:0,rpc:vi.fn(),failAssets:false}));
vi.mock('./player-supabase',()=>({createPlayerAdminClient:()=>({rpc:db.rpc,from:(table:string)=>{
 const query={select:()=>query,eq:()=>query,in:(key:string,ids:string[])=>{if(key==='id'||key==='asset_id')db.requested[table]=[...new Set([...(db.requested[table]??[]),...ids])];return query;},order:()=>query,limit:()=>query,maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:db.rows[table]?.[0],error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:db.rows[table]??[],error:db.failAssets&&table==='media_assets'?{code:'08006'}:null}).then(resolve)};return query;
},storage:{from:()=>({createSignedUrl:async(path:string)=>({data:{signedUrl:`https://storage.test/${path}?renewal=${++db.signed}`},error:null})})}})}));
const id=(n:number)=>`29400000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),release=id(2),itemId=id(3),template=id(4),hero=id(10),qr=id(11),logo=id(12),newHero=id(13);
const image=(key:string):PlayerDynamicTemplateAsset=>({bytes:100,checksumSha256:key===newHero?'d'.repeat(64):key===hero?'a'.repeat(64):key===qr?'b'.repeat(64):'c'.repeat(64),mimeType:'image/webp',url:`https://storage.test/${key}.webp`});
const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',slideType:'news',secondsPerPage:4,...(()=>{const seed=createSyncStudioStarter({family:'rss',tenantName:'Interne regressie',theme:'onzetrots-tv'}).syncPresentation!;return{rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,seed};})()});
const data=(photo=hero)=>({type:'news',syncPlaybackProtocol:2,generatedAt:'2026-10-25T12:00:00Z',syncConfiguration:cfg,news:{sourceName:'Testredactie',providerLogoMediaAssetId:logo,articles:[{externalId:'article-1',title:'Gecontroleerd bronartikel',intro:'Een echte bronfoto bij nieuwe feiten.',link:'https://www.duindorpsv.nl/nieuws',sourceName:'Testredactie',heroMediaAssetId:photo,qrMediaAssetId:qr}]}});
const {job,prepared,path}=sourceRefreshDescriptorFixture(cfg,data(),{[hero]:image(hero),[qr]:image(qr),[logo]:image(logo)},{tenantId:tenant,templateVersionId:template});
const input={tenantId:tenant,releaseId:release,syncDynamicMode:'dom-v2' as const,enableSyncBackgrounds:true,enableSyncOnzeTrots:true,enableSyncOnzeTrotsV9:true,enableSyncOnzeTrotsCurrent:true,device:{id:id(5),screenId:id(6),screenName:'Interne regressie',activeReleaseId:release,desiredReleaseId:release}};
beforeEach(()=>{
 db.requested={};db.signed=0;db.rpc.mockReset();db.failAssets=false;
 db.rows={playlist_releases:[{id:release,tenant_id:tenant,playlist_id:id(7),version:1,manifest_hash:'e'.repeat(64),manifest_json:{},published_at:'2026-10-25T12:00:00Z',total_bytes:prepared.byteLength,total_duration_seconds:4}],playlist_release_items:[{id:itemId,source_item_id:id(8),live_data_enabled:true,asset_kind:'composition',asset_title:'RSS',duration_seconds:4,fit_mode:'contain',muted:true,transition:'cut',crop_focus_x:0.5,crop_focus_y:0.5,volume_percent:0,trim_start_seconds:0,trim_end_seconds:null,enabled:true,storage_bucket:'tenant-media',storage_path:path,mime_type:prepared.dom.mimeType,file_size_bytes:prepared.byteLength,checksum_sha256:prepared.checksumSha256,dynamic_snapshot_id:job.snapshotId}],dynamic_slide_snapshots:[{id:job.snapshotId,dynamic_slide_version_id:job.slideVersionId,template_version_id:template,source_revision_hash:job.snapshotHash,status:'ready',snapshot_data_json:data(),sync_render_result_json:{...prepared.dom,byteLength:prepared.byteLength,checksumSha256:prepared.checksumSha256,width:prepared.width,height:prepared.height,storagePath:path}}],published_dynamic_data:[{snapshot_id:job.snapshotId,data_revision:2,content_hash:'f'.repeat(64),data_json:data()}],dynamic_template_versions:[{id:template,template_id:id(9)}],dynamic_templates:[{id:id(9),slug:'rss-refresh',slide_type:'news',orientation:'landscape'}],media_assets:[hero,qr,logo,newHero].map(key=>({id:key,kind:'image'})),media_variants:[hero,qr,logo,newHero].map(key=>({asset_id:key,variant_type:'original',storage_bucket:'tenant-media',storage_path:`tenants/${tenant}/assets/${key}/original.webp`,mime_type:'image/webp',file_size_bytes:100,checksum_sha256:image(key).checksumSha256}))};
});

it('keeps canonical RSS photo, QR and supplier logo through the actual live manifest projection',async()=>{
 const envelope=await loadPlayerReleaseEnvelope(input),item=envelope.manifest.items[0]!;
 expect(db.requested.media_assets).toEqual(expect.arrayContaining([hero,qr,logo]));
 expect(item.syncDynamic&&'rich'in item.syncDynamic.presentation?item.syncDynamic.presentation.rich?.news?.[0]:undefined).toMatchObject({heroImage:{mediaAssetId:hero,checksumSha256:image(hero).checksumSha256},providerLogo:{mediaAssetId:logo,checksumSha256:image(logo).checksumSha256}});
 const keys=getCacheableAssets(envelope.manifest).map(asset=>asset.checksumSha256);expect(keys).toContain(image(hero).checksumSha256);expect(keys).toContain(image(logo).checksumSha256);
 expect(item.source.checksumSha256).toBe(prepared.checksumSha256);expect(item.syncDynamic?.dataRevision).toBe(2);expect(item.syncDynamicBinary).toBeUndefined();expect(db.rpc).not.toHaveBeenCalled();
});
it('prepares genuinely new source media but keeps cache identity on signed-URL renewal',async()=>{
 const first=await loadPlayerReleaseEnvelope(input),again=await loadPlayerReleaseEnvelope(input);
 expect(getCacheableAssets(again.manifest).map(a=>a.cacheKey)).toEqual(getCacheableAssets(first.manifest).map(a=>a.cacheKey));
 db.rows.published_dynamic_data=[{snapshot_id:job.snapshotId,data_revision:3,content_hash:'9'.repeat(64),data_json:data(newHero)}];
 const changed=await loadPlayerReleaseEnvelope(input),item=changed.manifest.items[0]!;
 expect(item.syncDynamic&&'rich'in item.syncDynamic.presentation?item.syncDynamic.presentation.rich?.news?.[0]?.heroImage:undefined).toMatchObject({mediaAssetId:newHero,checksumSha256:image(newHero).checksumSha256});
 expect(getCacheableAssets(changed.manifest).map(a=>a.checksumSha256)).toContain(image(newHero).checksumSha256);
 expect(item.source).toMatchObject({checksumSha256:prepared.checksumSha256,bytes:prepared.byteLength});expect(item.syncDynamic?.configurationHash).toBe(first.manifest.items[0]!.syncDynamic?.configurationHash);expect(changed.manifest.releaseId).toBe(release);expect(db.rpc).not.toHaveBeenCalled();
});
it('rejects an incomplete canonical asset lookup instead of publishing a media-stripped candidate',async()=>{
 db.failAssets=true;await expect(loadPlayerReleaseEnvelope(input)).rejects.toThrow('SYNC_DYNAMIC_DATA_ASSETS_UNAVAILABLE');
});
it('collects all 101 valid RSS media references with deduplication and UUID bounds',()=>{
 const articles=Array.from({length:50},(_,n)=>({heroMediaAssetId:id(100+n*2),qrMediaAssetId:id(101+n*2)}));
 const ids=syncDynamicProjectionAssetIds({news:{providerLogoMediaAssetId:logo,articles:[...articles,{heroMediaAssetId:'invalid',qrMediaAssetId:'https://untrusted.test'}]}},cfg);
 expect(ids).toHaveLength(101);expect(new Set(ids).size).toBe(101);expect(ids).toContain(logo);expect(ids).toContain(id(199));
});
