import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {syncSlidePresentationSchema} from '@veyocast/contracts';
import {menuDomFixtureJob} from '../../../tests/helpers/menu-dom-fixture';
import {SupabaseDynamicRenderBackend,dynamicRenderStoragePath,type DynamicRenderArtifact} from '../src/dynamic-render-backend';
import {prepareMenuDomDescriptor} from '../src/menu-dom-render';
import {runDynamicRenderOnce} from '../src/dynamic-render-runner';

function fixture(){
 const original=menuDomFixtureJob(),job={...original,jobId:original.snapshotId,publishedRefresh:true,manifest:{...original.manifest,allowedFields:[{path:'menuDocument.title',type:'string' as const,required:false}]}};
 const prepared=prepareMenuDomDescriptor(job,{});
 // Real existing native Menu output; this test covers transport and the
 // complete worker/backend handoff rather than mocking uploadArtifact itself.
 const bytes=readFileSync(new URL('../../../docs/implementation/s292-dom-ready-recovery/menu-landscape-light.png',import.meta.url));
 const checksumSha256=createHash('sha256').update(bytes).digest('hex');
 const artifact:DynamicRenderArtifact={bytes,byteLength:bytes.byteLength,checksumSha256,width:1920,height:1080,storagePath:dynamicRenderStoragePath(job,'image/png',checksumSha256),menuBinary:{...prepared.menuDom,mimeType:'image/png'}};
 const upload=vi.fn(async()=>({error:null})),list=vi.fn(async()=>({data:[]as Array<{name:string}>,error:null})),remove=vi.fn(async()=>({error:null}));
 const raw={published_refresh:true,job_id:job.jobId,snapshot_id:job.snapshotId,tenant_id:job.tenantId,output_media_asset_id:job.outputMediaAssetId,slide_name:job.slideName,orientation:job.orientation,markup:job.markup,css:job.css,manifest_json:job.manifest,snapshot_data_json:job.snapshotData,template_version_id:job.templateVersionId,template_slug:job.templateSlug,source_revision_hash:job.snapshotHash,dynamic_slide_version_id:job.slideVersionId,lease_token:job.leaseToken};
 const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>({data:name.startsWith('claim_')?[raw]:name.startsWith('fail_')?'failed':name==='validate_sync_binary_storage_v1'?args.p_snapshot_id===job.snapshotId&&args.p_lease_token===job.leaseToken&&args.p_slot_id===job.outputMediaAssetId:true,error:null}));
 const backend=new SupabaseDynamicRenderBackend('https://storage.test','controlled-test-key',{rpc,storage:{from:()=>({upload,list,remove})}},'legacy');
 return{job,prepared,bytes,artifact,upload,list,remove,rpc,backend};
}

it('uploads a complete Menu PNG without requiring a separate Source poster',async()=>{
 const f=fixture();await f.backend.uploadArtifact(f.job,f.artifact);await f.backend.completeJob(f.job,'menu-worker',f.artifact);
 expect(f.upload).toHaveBeenCalledOnce();
 const [uploadedPath,uploadedBytes,uploadOptions]=f.upload.mock.calls[0] as unknown as [string,Uint8Array,{contentType:string}];
 expect(uploadedPath).toBe(f.artifact.storagePath);expect(uploadedBytes).toBe(f.bytes);expect(uploadOptions).toMatchObject({contentType:'image/png'});
 expect(f.rpc).toHaveBeenCalledWith('validate_sync_binary_storage_v1',expect.objectContaining({p_lease_token:f.job.leaseToken,p_slot_id:f.job.outputMediaAssetId}));
 expect(f.rpc).toHaveBeenCalledWith('complete_menu_binary_render_v2',expect.objectContaining({p_tenant_id:f.job.tenantId,p_snapshot_id:f.job.snapshotId,p_artifact:expect.objectContaining({schemaVersion:2,mimeType:'image/png',durationMs:12000})}));
 const receipt=f.rpc.mock.calls.find(([name])=>name==='complete_menu_binary_render_v2')![1].p_artifact as Record<string,unknown>;
 expect(Object.keys(receipt)).toHaveLength(9);
 expect(JSON.stringify(f.rpc.mock.calls)).not.toContain('"poster"');expect(JSON.stringify(f.rpc.mock.calls)).not.toContain('"bytes"');
});

it('runs the real Menu worker through its real upload and completion backend',async()=>{
 const f=fixture();
 const renderPng=vi.fn(async()=>f.bytes),renderer={renderPng:vi.fn(async()=>f.bytes),renderRgba:vi.fn(async()=>f.bytes)};
 const result=await runDynamicRenderOnce({backend:f.backend,renderer,reactDomRenderer:{renderPng},config:{workerId:'menu-worker',lockTimeoutSeconds:60,maxAttempts:3}});
 expect(result.status).toBe('completed');expect(renderPng).toHaveBeenCalledOnce();expect(renderer.renderPng).not.toHaveBeenCalled();expect(f.upload).toHaveBeenCalledOnce();
 expect(f.rpc).toHaveBeenCalledWith('complete_menu_binary_render_v2',expect.objectContaining({p_snapshot_id:f.job.snapshotId}));
});

it('keeps the 64 MiB Menu output budget before listing or overwriting any slot',async()=>{
 const f=fixture();await expect(f.backend.uploadArtifact(f.job,{...f.artifact,byteLength:64*1024*1024+1})).rejects.toMatchObject({code:'binary_cache_artifact_budget_exceeded'});
 expect(f.list).not.toHaveBeenCalled();expect(f.remove).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('verifies Menu PNG bytes before touching a cache slot',async()=>{
 const f=fixture();await expect(f.backend.uploadArtifact(f.job,{...f.artifact,bytes:new Uint8Array([1,2,3])})).rejects.toMatchObject({code:'sync_dynamic_artifact_integrity_invalid'});
 expect(f.list).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('does not reinterpret a historical Menu snapshot as the new PNG contract',async()=>{
 const f=fixture(),data={...f.job.snapshotData,syncPlaybackProtocol:1};
 await expect(f.backend.uploadArtifact({...f.job,snapshotData:data},f.artifact)).rejects.toMatchObject({code:'dynamic_claim_payload_invalid'});expect(f.list).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('cannot use Menu metadata to bypass a Source poster requirement',async()=>{
 const f=fixture();await expect(f.backend.uploadArtifact({...f.job,snapshotData:{...f.job.snapshotData,syncConfiguration:{}}},f.artifact)).rejects.toMatchObject({code:'dynamic_claim_payload_invalid'});
 expect(f.list).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('rejects a stale Menu lease before any upload or deletion',async()=>{
 const f=fixture();f.rpc.mockResolvedValue({data:false,error:null});
 await expect(f.backend.uploadArtifact(f.job,f.artifact)).rejects.toMatchObject({code:'dynamic_render_lease_lost'});expect(f.remove).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('retains the existing missing-Source-output rejection',async()=>{
 const f=fixture();await expect(f.backend.uploadArtifact(f.job,{...f.artifact,menuBinary:undefined,storagePath:dynamicRenderStoragePath(f.job)})).rejects.toMatchObject({code:'binary_cache_artifact_budget_exceeded'});expect(f.list).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('keeps the 16 MiB Source poster budget independently of Menu PNG support',async()=>{
 const f=fixture();const presentation=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'fixtures',orientation:'landscape',theme:'fieldflow',name:'Source',title:'Programma',club:{name:'Testclub'},style:{motion:'geen'}});
 const sync={mimeType:'image/png' as const,durationMs:12000,presentation,poster:{bytes:new Uint8Array(),byteLength:16*1024*1024+1,checksumSha256:'b'.repeat(64),storagePath:dynamicRenderStoragePath(f.job,'image/png','b'.repeat(64))}};
 await expect(f.backend.uploadArtifact(f.job,{...f.artifact,menuBinary:undefined,sync})).rejects.toMatchObject({code:'binary_cache_artifact_budget_exceeded'});expect(f.list).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it('checks descriptor integrity for the actual Menu DOM upload as well',async()=>{
 const f=fixture(),job={...f.job,publishedRefresh:false};
 const artifact:DynamicRenderArtifact={...f.prepared,storagePath:dynamicRenderStoragePath(job,f.prepared.menuDom.mimeType,f.prepared.checksumSha256)};
 await expect(f.backend.uploadArtifact(job,{...artifact,bytes:new Uint8Array([1])})).rejects.toMatchObject({code:'sync_dynamic_artifact_integrity_invalid'});expect(f.upload).not.toHaveBeenCalled();
 await f.backend.uploadArtifact(job,artifact);expect(f.upload).toHaveBeenCalledWith(artifact.storagePath,artifact.bytes,expect.objectContaining({contentType:'application/vnd.veyocast.sync-dom+json'}));
});
