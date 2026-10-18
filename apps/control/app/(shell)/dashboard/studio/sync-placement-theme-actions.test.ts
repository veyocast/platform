import {beforeEach,expect,it,vi} from 'vitest';
import {createSyncStudioStarter,createSyncStudioDocument} from '@veyocast/studio';
import {prepareStudioPlacementThemeAction} from './sites-placement-theme-actions';
const f=vi.hoisted(()=>({document:{} as unknown,capabilities:['tenant.studio.render'],filters:[] as Array<[string,unknown]>,rpc:vi.fn()}));
const tenant='10000000-0000-4000-8000-000000000226',exportId='20000000-0000-4000-8000-000000000226',projectId='30000000-0000-4000-8000-000000000226',revisionId='40000000-0000-4000-8000-000000000226',jobId='50000000-0000-4000-8000-000000000226',key='60000000-0000-4000-8000-000000000226';
vi.mock('../../../../lib/control-session',()=>({requireTenantControlSession:async()=>({isLive:true,tenantId:tenant,tenantStatus:'active',capabilities:f.capabilities})}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:async()=>({rpc:f.rpc,from:(table:string)=>{const builder={select:()=>builder,eq:(field:string,value:unknown)=>{f.filters.push([field,value]);return builder;},maybeSingle:async()=>({error:null,data:table==='studio_exports'?{id:exportId,project_id:projectId,revision_id:revisionId,output_kind:'mp4'}:{document_json:f.document}})};return builder;}})}));
beforeEach(()=>{f.capabilities=['tenant.studio.render'];f.filters=[];f.document=createSyncStudioStarter({family:'club-story',tenantName:'Ons clubhuis'});f.rpc.mockReset().mockImplementation(async(name:string)=>({error:null,data:name==='create_studio_project_v1'?{projectId}:{renderJobId:jobId}}));});
it('forks a frozen Source export into a separate theme render while preserving content and Motion',async()=>{
 const original=JSON.parse(JSON.stringify(f.document));
 await expect(prepareStudioPlacementThemeAction({exportId,themeId:'onzetrots-tv',idempotencyKey:key})).resolves.toMatchObject({ok:true,status:'pending',projectId,jobId});
 const create=f.rpc.mock.calls[0]!;expect(create[0]).toBe('create_studio_project_v1');expect(create[1].p_tenant_id).toBe(tenant);
 expect(create[1].p_document).toEqual({...original,syncPresentation:{...original.syncPresentation,theme:'onzetrots-tv'}});
 expect(f.document).toEqual(original);expect(f.filters.filter(([field])=>field==='tenant_id')).toEqual([['tenant_id',tenant],['tenant_id',tenant]]);
 expect(f.rpc.mock.calls[1]).toEqual(['request_studio_render_v1',{p_expected_draft_revision:0,p_idempotency_key:expect.any(String),p_output_kind:'mp4',p_project_id:projectId}]);
 const commandKeys=f.rpc.mock.calls.map(([,args])=>args.p_idempotency_key);await prepareStudioPlacementThemeAction({exportId,themeId:'onzetrots-tv',idempotencyKey:key});expect(f.rpc.mock.calls.slice(2).map(([,args])=>args.p_idempotency_key)).toEqual(commandKeys);
});
it('keeps every page and the original total duration when changing a multipage Source theme',async()=>{
 const source=createSyncStudioStarter({family:'fixtures',tenantName:'Ons clubhuis'}).syncPresentation!;
 const presentation={...source,rows:Array.from({length:5},(_,i)=>[`Wedstrijd ${i+1}`,'12:00','Thuis','Uit'] as [string,string,string,string]),rowsPerPage:4,style:{...source.style,motion:'geen' as const}};
 f.document=createSyncStudioDocument(presentation,3);
 await expect(prepareStudioPlacementThemeAction({exportId,themeId:'onzetrots-tv',idempotencyKey:key})).resolves.toMatchObject({ok:true});
 const changed=f.rpc.mock.calls[0]![1].p_document;expect(changed.motion.durationMs).toBe(6000);expect(changed.syncPresentation.rows).toEqual(presentation.rows);expect(changed.syncPresentation.theme).toBe('onzetrots-tv');
});
it('does not create a Source copy without render permission',async()=>{f.capabilities=[];await expect(prepareStudioPlacementThemeAction({exportId,themeId:'onzetrots-tv',idempotencyKey:key})).resolves.toMatchObject({ok:false});expect(f.rpc).not.toHaveBeenCalled();});
it('changes Source duration only through a new verified render request',async()=>{
 await expect(prepareStudioPlacementThemeAction({exportId,themeId:'fieldflow',secondsPerPage:8,idempotencyKey:key})).resolves.toMatchObject({ok:true,status:'pending'});
 expect(f.rpc.mock.calls[0]![1].p_document.motion.durationMs).toBe(8000);
 expect((f.document as {motion:{durationMs:number}}).motion.durationMs).toBe(12000);
});
