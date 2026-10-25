import{beforeEach,it,expect,vi}from'vitest';
import{syncDynamicConfigurationSchema}from'@veyocast/contracts';
import{createSyncStudioStarter}from'@veyocast/studio';
const f=vi.hoisted(()=>({rpc:vi.fn(),assets:vi.fn(),project:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('../../../../lib/control-session',()=>({requireTenantControlSession:async()=>({isLive:true,tenantId:'10000000-0000-4000-8000-000000000291',tenantStatus:'active'})}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:async()=>({rpc:f.rpc})}));
vi.mock('../../../../lib/dynamic-preview-assets',()=>({collectPreviewMediaAssetIds:(v:Record<string,unknown>)=>v.requiredAsset?['40000000-0000-4000-8000-000000000291']:[],loadPreviewAssets:f.assets}));
vi.mock('@veyocast/content-templates/sync-dynamic-projector',()=>({projectSyncDynamicSnapshot:f.project}));
import{previewSyncDynamicAuthoringAction}from'./sync-dynamic-actions';
const seed=createSyncStudioStarter({family:'rss',tenantName:'Eigen club',theme:'onzetrots-tv'}).syncPresentation!;
const cfg=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'news',seed,secondsPerPage:10});
const input={templateVersionId:'20000000-0000-4000-8000-000000000291',dataSourceId:'30000000-0000-4000-8000-000000000291',configuration:{syncConfiguration:cfg}};
const data=()=>({previewId:'50000000-0000-4000-8000-000000000291',templateVersionId:input.templateVersionId,templateSlug:'news',slideType:'news',orientation:'landscape',data:{type:'news',news:{articles:[]}},source:{providerStatus:'healthy',lastSuccessfulSyncAt:null,lastErrorCode:null}});
beforeEach(()=>{vi.clearAllMocks();f.rpc.mockResolvedValue({data:data(),error:null});f.assets.mockResolvedValue(new Map());f.project.mockReturnValue({ok:true,presentation:seed});});
it('distinguishes RPC, malformed envelope, assets, payload and projector failures and recovers on the next valid check',async()=>{
 const cases=[{data:null,error:{code:'42501'}},{data:null,error:null},{data:{...data(),data:{requiredAsset:true}},error:null},{data:{...data(),previewId:'invalid'},error:null}];
 for(const[index,response]of cases.entries()){f.rpc.mockResolvedValueOnce(response);expect(await previewSyncDynamicAuthoringAction(input)).toMatchObject({ok:false,phase:['rpc','envelope','assets','payload'][index],correlationId:expect.any(String)});}
 f.project.mockReturnValueOnce({ok:false,code:'SYNC_INVALID'});expect(await previewSyncDynamicAuthoringAction(input)).toMatchObject({phase:'projector'});
 f.rpc.mockRejectedValueOnce(Error('PRIVATE provider token'));const failed=await previewSyncDynamicAuthoringAction(input);expect(failed).toMatchObject({phase:'rpc',code:'08006'});expect(JSON.stringify(failed)).not.toContain('PRIVATE');
 expect(await previewSyncDynamicAuthoringAction(input)).toMatchObject({ok:true,presentation:seed});
 expect(f.rpc).toHaveBeenCalledTimes(7);for(const call of f.rpc.mock.calls)expect(call[0]).toBe('preview_dynamic_slide_v1');
});
