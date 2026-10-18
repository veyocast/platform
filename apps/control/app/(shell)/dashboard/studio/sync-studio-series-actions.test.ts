import {beforeEach,expect,it,vi} from 'vitest';
import {mutateSyncStudioSeriesAction} from './sync-studio-series-actions';
import type {SyncStudioSeriesCommand} from './sync-studio-series-command';
const f=vi.hoisted(()=>({capabilities:['tenant.studio.edit_own','tenant.studio.create','tenant.studio.archive'],rpc:vi.fn()}));
const tenant='10000000-0000-4000-8000-000000000226',project='20000000-0000-4000-8000-000000000226',series='30000000-0000-4000-8000-000000000226',created='40000000-0000-4000-8000-000000000226',key='50000000-0000-4000-8000-000000000226';
vi.mock('../../../../lib/control-session',()=>({requireTenantControlSession:async()=>({isLive:true,tenantId:tenant,tenantStatus:'active',capabilities:f.capabilities})}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:async()=>({rpc:f.rpc})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
const input=():SyncStudioSeriesCommand=>({projectId:project,draftRevision:2,seriesId:null,seriesRevision:null,operation:'add',name:'Wedstrijddag',memberIds:null,idempotencyKey:key});
beforeEach(()=>{f.capabilities=['tenant.studio.edit_own','tenant.studio.create','tenant.studio.archive'];f.rpc.mockReset().mockResolvedValue({error:null,data:{outcome:'applied',seriesId:series,revision:1,projectIds:[project,created],nextProjectId:created}});});
it('preserves the complete explicit Source collection command and stable receipt identity',async()=>{
 await expect(mutateSyncStudioSeriesAction(input())).resolves.toEqual({ok:true,seriesId:series,revision:1,projectIds:[project,created],nextProjectId:created});
 await mutateSyncStudioSeriesAction(input());expect(f.rpc.mock.calls).toEqual(Array.from({length:2},()=>['mutate_sync_studio_series_v1',{p_project_id:project,p_expected_draft_revision:2,p_series_id:null,p_expected_series_revision:null,p_operation:'add',p_name:'Wedstrijddag',p_member_ids:null,p_idempotency_key:key}]));
});
it('does not infer success from an incomplete or unrelated collection acknowledgement',async()=>{
 f.rpc.mockResolvedValue({error:null,data:{outcome:'applied',seriesId:series,revision:1,projectIds:[project],nextProjectId:created}});const result=await mutateSyncStudioSeriesAction(input());expect(result).toMatchObject({ok:false});expect(result).not.toHaveProperty('rejected',true);
});
it('requires fresh edit/create/archive capabilities before admitting each operation',async()=>{
 f.capabilities=['tenant.studio.read'];await expect(mutateSyncStudioSeriesAction(input())).resolves.toMatchObject({ok:false,rejected:true});expect(f.rpc).not.toHaveBeenCalled();
 f.capabilities=['tenant.studio.edit_own'];await expect(mutateSyncStudioSeriesAction(input())).resolves.toMatchObject({ok:false,rejected:true});await expect(mutateSyncStudioSeriesAction({...input(),operation:'remove',seriesId:series,seriesRevision:1})).resolves.toMatchObject({ok:false,rejected:true});expect(f.rpc).not.toHaveBeenCalled();
});
it('reports real CAS conflicts and rejects foreign tenant input instead of forwarding it',async()=>{
 f.rpc.mockResolvedValue({error:{code:'PT409'},data:null});await expect(mutateSyncStudioSeriesAction(input())).resolves.toMatchObject({ok:false,rejected:true,conflict:true});
 f.rpc.mockClear();await expect(mutateSyncStudioSeriesAction({...input(),tenantId:tenant} as SyncStudioSeriesCommand)).resolves.toMatchObject({ok:false,rejected:true});expect(f.rpc).not.toHaveBeenCalled();
});
