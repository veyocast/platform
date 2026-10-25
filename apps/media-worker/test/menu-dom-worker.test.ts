import{expect,it,vi}from'vitest';
import{menuDomFixtureJob}from'../../../tests/helpers/menu-dom-fixture';
import{runDynamicRenderOnce}from'../src/dynamic-render-runner';
import{type DynamicRenderBackend,type DynamicRenderArtifact}from'../src/dynamic-render-backend';
function fixture(){
 const job=menuDomFixtureJob(),bytes=new Uint8Array([1,2,3]);
 const backend={claimJob:vi.fn(async()=>job),renewJob:vi.fn(async()=>true),resolveAssets:vi.fn(async()=>({})),uploadArtifact:vi.fn<DynamicRenderBackend['uploadArtifact']>(async()=>{}),completeJob:vi.fn(async()=>{}),failJob:vi.fn(async()=>'failed' as const)}satisfies DynamicRenderBackend;
 return{job,backend,renderer:{renderPng:vi.fn(async()=>bytes),renderRgba:vi.fn(async()=>bytes)},reactDomRenderer:{renderPng:vi.fn(async()=>bytes)},config:{workerId:'menu-dom',lockTimeoutSeconds:30,maxAttempts:3}};
}
it('prepares the real MenuDocument widget projection without entering either raster renderer',async()=>{
 const value=fixture();expect(await runDynamicRenderOnce(value)).toMatchObject({status:'completed'});expect(value.renderer.renderPng).not.toHaveBeenCalled();expect(value.reactDomRenderer.renderPng).not.toHaveBeenCalled();
 const artifact=value.backend.uploadArtifact.mock.calls[0]![1]as DynamicRenderArtifact;expect(artifact.menuDom).toMatchObject({schemaVersion:2,durationMs:12000,presentation:{kind:'dynamic',content:{menuPages:expect.any(Array)}}});expect(artifact).not.toHaveProperty('sync');expect(artifact).not.toHaveProperty('menuBinary');expect(artifact.storagePath).toMatch(/\/sync-dom\/[a-f0-9]{64}\.json$/);expect(value.backend.completeJob).toHaveBeenCalledWith(value.job,'menu-dom',artifact);
});
it('uses the existing renderer only for an explicitly claimed legacy/export cache slot',async()=>{
 const value=fixture();const job={...value.job,publishedRefresh:true};value.backend.claimJob.mockResolvedValue(job);expect(await runDynamicRenderOnce(value)).toMatchObject({status:'completed'});expect(value.reactDomRenderer.renderPng).toHaveBeenCalledOnce();expect(value.renderer.renderPng).not.toHaveBeenCalled();const artifact=value.backend.uploadArtifact.mock.calls[0]![1]as DynamicRenderArtifact;expect(artifact.menuBinary).toMatchObject({mimeType:'image/png',durationMs:12000});expect(artifact).not.toHaveProperty('menuDom');expect(artifact.storagePath).toContain('/sync-dynamic/'+job.leaseToken+'-');
});
it('rejects a Menu DOM attempt without lease renewal before uploading any descriptor',async()=>{
 const value=fixture(),backend:DynamicRenderBackend={...value.backend,renewJob:undefined};expect(await runDynamicRenderOnce({...value,backend})).toMatchObject({status:'failed',errorCode:'menu_dom_lease_unavailable'});expect(value.backend.uploadArtifact).not.toHaveBeenCalled();
});
