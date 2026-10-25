import {createHash} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
import {syncSlidePresentationSchema} from '@veyocast/contracts';
import {SupabaseDynamicRenderBackend,collectDynamicRenderAssetIds,dynamicRenderStoragePath,parseClaimedDynamicRenderJob,type ClaimedDynamicRenderJob,type DynamicRenderArtifact,type DynamicRenderBackend} from '../src/dynamic-render-backend';
import {runDynamicRenderOnce} from '../src/dynamic-render-runner';
import type {renderSyncDynamicArtifact} from '../src/sync-dynamic-render';
const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'fixtures',orientation:'landscape',theme:'fieldflow',name:'Eigen bronontwerp',title:'Eigen programma',club:{name:'Club A'},style:{motion:'geen'}});
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const job:ClaimedDynamicRenderJob={jobId:'10000000-0000-4000-8000-000000000226',snapshotId:'20000000-0000-4000-8000-000000000226',tenantId:'30000000-0000-4000-8000-000000000226',outputMediaAssetId:'40000000-0000-4000-8000-000000000226',templateVersionId:'50000000-0000-4000-8000-000000000226',templateSlug:'actual-registered-template',snapshotHash:'a'.repeat(64),slideVersionId:'60000000-0000-4000-8000-000000000226',leaseToken:'70000000-0000-4000-8000-000000000226',orientation:'landscape',slideName:'Eigen programma',markup:'unused',css:'',manifest:{engine:'veyocast-safe-template-v1',schemaVersion:1,canvas:{width:1920,height:1080},slideType:'sport_program',allowedFields:[{path:'sport.title',type:'string',required:false}],maxCollectionItems:40},snapshotData:{syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'sport_program',seed,secondsPerPage:3}}};
 const bytes=new Uint8Array([1,2,3]),poster=new Uint8Array([4,5]);
 const rendered={bytes,byteLength:3,checksumSha256:sha(bytes),width:1920,height:1080,mimeType:'video/mp4' as const,durationMs:6000,presentation:seed,poster:{bytes:poster,byteLength:2,checksumSha256:sha(poster)}};
 const sourceRenderer=vi.fn<typeof renderSyncDynamicArtifact>(async()=>rendered);
 const backend={claimJob:vi.fn(async()=>job),renewJob:vi.fn(async()=>true),resolveAssets:vi.fn(async()=>({})),uploadArtifact:vi.fn<DynamicRenderBackend['uploadArtifact']>(async()=>{}),completeJob:vi.fn(async()=>{}),failJob:vi.fn(async()=>'failed' as const)}satisfies DynamicRenderBackend;
 const renderer={renderPng:vi.fn(async()=>bytes),renderRgba:vi.fn(async()=>bytes)},reactDomRenderer={renderPng:vi.fn(async()=>bytes)};
 const config={workerId:'same-worker',lockTimeoutSeconds:30,maxAttempts:3};
 return {job,rendered,sourceRenderer,backend,renderer,reactDomRenderer,config};
}
afterEach(()=>vi.useRealTimers());
it('uses the complete Source renderer and fenced completion without invoking the old first-page renderers',async()=>{
 const f=fixture();expect(await runDynamicRenderOnce(f)).toMatchObject({status:'completed',jobId:f.job.jobId});
 expect(f.renderer.renderPng).not.toHaveBeenCalled();expect(f.reactDomRenderer.renderPng).not.toHaveBeenCalled();expect(f.sourceRenderer).toHaveBeenCalledOnce();expect(f.backend.renewJob).toHaveBeenCalledTimes(3);
 const artifact=f.backend.uploadArtifact.mock.calls[0]![1] as DynamicRenderArtifact;
 expect(artifact.storagePath).toBe(dynamicRenderStoragePath(f.job,'video/mp4',f.rendered.checksumSha256));expect(artifact.sync).toMatchObject({durationMs:6000,mimeType:'video/mp4',poster:{checksumSha256:f.rendered.poster.checksumSha256}});
 expect(f.backend.completeJob).toHaveBeenCalledWith(f.job,'same-worker',artifact);
});
it('aborts a long capture when the same job has been reclaimed and never reports failure against the new attempt',async()=>{
 vi.useFakeTimers();const f=fixture();f.backend.renewJob.mockResolvedValueOnce(true).mockResolvedValue(false);
 f.sourceRenderer.mockImplementation(async({signal})=>{await new Promise((_,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));return f.rendered;});
 const result=runDynamicRenderOnce(f);await vi.advanceTimersByTimeAsync(10001);
 expect(await result).toMatchObject({status:'lease_lost',errorCode:'dynamic_render_lease_lost'});expect(f.backend.uploadArtifact).not.toHaveBeenCalled();expect(f.backend.completeJob).not.toHaveBeenCalled();expect(f.backend.failJob).not.toHaveBeenCalled();
});
it('stops lease renewals before completing, without turning its own completion into lease loss',async()=>{
 vi.useFakeTimers();const f=fixture();expect(await runDynamicRenderOnce(f)).toMatchObject({status:'completed'});const calls=f.backend.renewJob.mock.calls.length;await vi.advanceTimersByTimeAsync(60000);expect(f.backend.renewJob).toHaveBeenCalledTimes(calls);
});
it('refuses a Source job without lease renewal instead of falling back to an old renderer',async()=>{
 const f=fixture();const backend:DynamicRenderBackend={...f.backend,renewJob:undefined};expect(await runDynamicRenderOnce({...f,backend})).toMatchObject({status:'failed',errorCode:'sync_dynamic_lease_unavailable'});expect(f.sourceRenderer).not.toHaveBeenCalled();expect(f.renderer.renderPng).not.toHaveBeenCalled();
});
it('carries real immutable metadata and rejects partial modern claim identities',()=>{
 const f=fixture(),raw={job_id:f.job.jobId,snapshot_id:f.job.snapshotId,tenant_id:f.job.tenantId,output_media_asset_id:f.job.outputMediaAssetId,slide_name:f.job.slideName,orientation:f.job.orientation,markup:'',css:'',manifest_json:f.job.manifest,snapshot_data_json:f.job.snapshotData,template_version_id:f.job.templateVersionId,template_slug:f.job.templateSlug,source_revision_hash:f.job.snapshotHash,dynamic_slide_version_id:f.job.slideVersionId,lease_token:f.job.leaseToken};
 expect(parseClaimedDynamicRenderJob(raw)).toEqual({...f.job,markup:''});expect(()=>parseClaimedDynamicRenderJob({...raw,source_revision_hash:undefined})).toThrow(expect.objectContaining({code:'dynamic_claim_payload_invalid'}));
});
it('uploads independent checksum-bound video and poster, then sends only metadata to completion',async()=>{
 const f=fixture(),rpc=vi.fn<(...args:[string,Record<string,unknown>])=>Promise<{data:null;error:null}>>(async()=>({data:null,error:null})),upload=vi.fn<(...args:[string,Uint8Array,Record<string,unknown>])=>Promise<{error:null}>>(async()=>({error:null}));
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-service-key',{rpc,storage:{from:()=>({upload})}});
 const artifact:DynamicRenderArtifact={bytes:f.rendered.bytes,byteLength:3,checksumSha256:f.rendered.checksumSha256,width:1920,height:1080,storagePath:dynamicRenderStoragePath(f.job,'video/mp4',f.rendered.checksumSha256),sync:{mimeType:'video/mp4',durationMs:6000,presentation:seed,poster:{...f.rendered.poster,storagePath:dynamicRenderStoragePath(f.job,'image/png',f.rendered.poster.checksumSha256)}}};
 await backend.uploadArtifact(f.job,artifact);expect(upload).toHaveBeenCalledTimes(2);expect(upload.mock.calls[0]![2]).toMatchObject({contentType:'image/png'});expect(upload.mock.calls[1]![2]).toMatchObject({contentType:'video/mp4'});
 await backend.completeJob(f.job,'same-worker',artifact);expect(rpc).toHaveBeenCalledWith('complete_dynamic_render_job_v2',expect.objectContaining({p_lease_token:f.job.leaseToken,p_artifact:expect.objectContaining({mimeType:'video/mp4',durationMs:6000,poster:{storagePath:artifact.sync!.poster.storagePath,byteLength:2,checksumSha256:f.rendered.poster.checksumSha256}})}));
 expect(JSON.stringify(rpc.mock.calls)).not.toContain('"bytes"');
 upload.mockClear();await expect(backend.uploadArtifact(f.job,{...artifact,bytes:new Uint8Array([9])})).rejects.toMatchObject({code:'sync_dynamic_artifact_integrity_invalid'});expect(upload).not.toHaveBeenCalled();
});
it('collects authored private Source background and logo through the same canonical asset resolver',()=>{
 const logoId='80000000-0000-4000-8000-000000000226',bgId='90000000-0000-4000-8000-000000000226';const f=fixture();
 const data=f.job.snapshotData as {syncConfiguration:Record<string,unknown>};data.syncConfiguration.seed={...seed,club:{...seed.club,logo:{kind:'tenant',mediaAssetId:logoId,checksumSha256:'b'.repeat(64)}},style:{...seed.style,background:'photo',backgroundAsset:{kind:'tenant',mediaAssetId:bgId,checksumSha256:'c'.repeat(64)}}};
 expect(collectDynamicRenderAssetIds(data)).toEqual(expect.arrayContaining([logoId,bgId]));
});

it('reuses only the inactive binary storage slot and completes through its distinct tenant-scoped lease',async()=>{
 const f=fixture();f.job.publishedRefresh=true;f.job.jobId=f.job.snapshotId;
 const order:string[]=[],oldName='f'.repeat(64)+'.png';
 const list=vi.fn(async()=>{order.push('list');return{data:[{name:oldName}],error:null};}),remove=vi.fn(async()=>{order.push('remove');return{error:null};}),upload=vi.fn(async()=>{order.push('upload');return{error:null};});
 const rpc=vi.fn(async(name:string)=>({data:name.startsWith('renew_')||name==='validate_sync_binary_storage_v1'?true:name.startsWith('fail_')?'queued':f.job.outputMediaAssetId,error:null}));
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-service-key',{rpc,storage:{from:()=>({list,remove,upload})}});
 const artifact:DynamicRenderArtifact={bytes:f.rendered.bytes,byteLength:3,checksumSha256:f.rendered.checksumSha256,width:1920,height:1080,storagePath:dynamicRenderStoragePath(f.job,'video/mp4',f.rendered.checksumSha256),sync:{mimeType:'video/mp4',durationMs:6000,presentation:seed,poster:{...f.rendered.poster,storagePath:dynamicRenderStoragePath(f.job,'image/png',f.rendered.poster.checksumSha256)}}};
 expect(await backend.renewJob(f.job,'same-worker')).toBe(true);await backend.uploadArtifact(f.job,artifact);await backend.completeJob(f.job,'same-worker',artifact);
 expect(order).toEqual(['list','remove','upload','upload']);expect(list).toHaveBeenCalledWith(`tenants/${f.job.tenantId}/assets/${f.job.outputMediaAssetId}/sync-dynamic`,{limit:100});expect(remove).toHaveBeenCalledWith([`tenants/${f.job.tenantId}/assets/${f.job.outputMediaAssetId}/sync-dynamic/${oldName}`]);
 expect(rpc).toHaveBeenCalledWith('complete_sync_binary_render_v1',expect.objectContaining({p_tenant_id:f.job.tenantId,p_snapshot_id:f.job.snapshotId,p_lease_token:f.job.leaseToken}));expect(rpc.mock.calls.some(([name])=>name==='complete_dynamic_render_job_v2')).toBe(false);
 list.mockResolvedValue({data:[{name:'unexpected-directory'}],error:null});upload.mockClear();remove.mockClear();await expect(backend.uploadArtifact(f.job,artifact)).rejects.toMatchObject({code:'binary_storage_cleanup_failed'});expect(upload).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();
 expect(await backend.failJob(f.job,'same-worker',{code:'binary_storage_cleanup_failed',message:'internal detail',retryable:true})).toBe('queued');expect(rpc).toHaveBeenLastCalledWith('fail_sync_binary_render_v1',expect.objectContaining({p_tenant_id:f.job.tenantId,p_snapshot_id:f.job.snapshotId,p_retryable:true}));
});
it('rejects a stale listing before it can delete a successor current binary',async()=>{
 const f=fixture();f.job.publishedRefresh=true;f.job.jobId=f.job.snapshotId;
 const successor='80000000-0000-4000-8000-000000000226';
 const list=vi.fn(async()=>({data:[{name:successor+'-'+f.rendered.checksumSha256+'.mp4'}],error:null}));
 const remove=vi.fn(async()=>({error:null})),upload=vi.fn(async()=>({error:null}));
 const rpc=vi.fn(async()=>({data:false,error:null}));
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-service-key',{rpc,storage:{from:()=>({list,remove,upload})}});
 const artifact:DynamicRenderArtifact={...f.rendered,storagePath:dynamicRenderStoragePath(f.job,'video/mp4',f.rendered.checksumSha256),sync:{...f.rendered,poster:{...f.rendered.poster,storagePath:dynamicRenderStoragePath(f.job,'image/png',f.rendered.poster.checksumSha256)}}};
 await expect(backend.uploadArtifact(f.job,artifact)).rejects.toMatchObject({code:'dynamic_render_lease_lost'});
 expect(remove).not.toHaveBeenCalled();expect(upload).not.toHaveBeenCalled();
 expect(dynamicRenderStoragePath({...f.job,leaseToken:successor},'video/mp4',f.rendered.checksumSha256)).not.toBe(artifact.storagePath);
});
it('never expands a captured deletion set after validation, even when a successor completes during the pause',async()=>{
 const f=fixture();f.job.publishedRefresh=true;f.job.jobId=f.job.snapshotId;
 const oldName='60000000-0000-4000-8000-000000000226-'+'a'.repeat(64)+'.mp4';
 const successorName='80000000-0000-4000-8000-000000000226-'+f.rendered.checksumSha256+'.mp4';
 const objects=new Set([oldName]);
 const list=vi.fn(async()=>({data:[...objects].map(name=>({name})),error:null}));
 const remove=vi.fn(async(paths:string[])=>{for(const path of paths)objects.delete(path.split('/').at(-1)!);return{error:null};});
 const upload=vi.fn(async()=>({error:null}));
 const rpc=vi.fn(async()=>{objects.add(successorName);return{data:true,error:null};});
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-service-key',{rpc,storage:{from:()=>({list,remove,upload})}});
 const artifact:DynamicRenderArtifact={...f.rendered,storagePath:dynamicRenderStoragePath(f.job,'video/mp4',f.rendered.checksumSha256),sync:{...f.rendered,poster:{...f.rendered.poster,storagePath:dynamicRenderStoragePath(f.job,'image/png',f.rendered.poster.checksumSha256)}}};
 await backend.uploadArtifact(f.job,artifact);expect(objects.has(successorName)).toBe(true);expect(list).toHaveBeenCalledOnce();expect(remove.mock.calls[0]![0]).toHaveLength(1);
});
it('deletes a retired configuration only after all three scoped storage listings succeed and retains failed cleanup work',async()=>{
 const f=fixture(),slots=[f.job.outputMediaAssetId,'80000000-0000-4000-8000-000000000226','90000000-0000-4000-8000-000000000226'];
 const claim={cleanup_only:true,tenant_id:f.job.tenantId,snapshot_id:f.job.snapshotId,lease_token:f.job.leaseToken,slot_ids:slots};
 const rpc=vi.fn(async(name:string)=>({data:name==='claim_dynamic_render_job_v4'?[claim]:true,error:null}));const list=vi.fn(async()=>({data:[]as Array<{name:string}>,error:null})),remove=vi.fn(async()=>({error:null})),upload=vi.fn(async()=>({error:null}));
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-service-key',{rpc,storage:{from:()=>({list,remove,upload})}});expect(await backend.claimJob('same-worker',60,3)).toBe(null);expect(list).toHaveBeenCalledTimes(3);expect(rpc).toHaveBeenLastCalledWith('finish_sync_binary_cleanup_v1',expect.objectContaining({p_success:true,p_snapshot_id:f.job.snapshotId}));expect(upload).not.toHaveBeenCalled();
 list.mockRejectedValueOnce(Error('Controlled storage outage'));await expect(backend.claimJob('same-worker',60,3)).rejects.toThrow('Controlled storage outage');expect(rpc).toHaveBeenLastCalledWith('finish_sync_binary_cleanup_v1',expect.objectContaining({p_success:false,p_snapshot_id:f.job.snapshotId}));
});

it.each(['menu','news','sport_program']as const)('prepares %s DOM-v2 with no capture, poster or encoder',async(type)=>{
 const f=fixture(),family=type==='news'?'rss':type==='menu'?'menu':'fixtures';
 const seed=syncSlidePresentationSchema.parse({...((f.job.snapshotData as {syncConfiguration:{seed:unknown}}).syncConfiguration.seed as object),family,style:{motion:'dynamisch'}});
 f.job.manifest.slideType=type;
 f.job.snapshotData={type,generatedAt:'2026-10-25T15:00:00Z',brand:{clubName:'Eigen club'},syncPlaybackProtocol:2,
  syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:type,seed,secondsPerPage:3},
  ...(type==='menu'?{menu:{products:[{id:'product-1',name:'Echte prijs',priceCents:250,category:'Kantine'}]}}:type==='news'?{news:{articles:[{id:'article-1',title:'Volledige kop',intro:'Gecontroleerd bericht',url:'https://news.example.test/1',sourceName:'Eigen bron',publishedAt:'2026-10-25T14:00:00Z'}]}}:{sport:{items:[{id:'match-1',homeTeam:'Team A',awayTeam:'Team B',date:'2026-10-26',time:'14:00',field:'1'}]}})};
 expect(await runDynamicRenderOnce(f)).toMatchObject({status:'completed'});
 expect(f.sourceRenderer).not.toHaveBeenCalled();expect(f.renderer.renderPng).not.toHaveBeenCalled();expect(f.renderer.renderRgba).not.toHaveBeenCalled();expect(f.reactDomRenderer.renderPng).not.toHaveBeenCalled();
 const artifact=f.backend.uploadArtifact.mock.calls[0]![1];
 expect(artifact.dom).toMatchObject({schemaVersion:2,mimeType:'application/vnd.veyocast.sync-dom+json'});expect(artifact.sync).toBeUndefined();
 expect(artifact.storagePath).toMatch(/\/sync-dom\/[a-f0-9]{64}\.json$/);
 expect(JSON.parse(new TextDecoder().decode(artifact.bytes))).toMatchObject({schemaVersion:2,snapshotId:f.job.snapshotId,configuration:{slideType:type}});
 expect(JSON.stringify(artifact)).not.toContain('poster');
});
