import { beforeEach, expect, it, vi } from 'vitest';
import { preparePublisherStudioSeries,preparePublisherSyncProject } from './prepare-studio-library';
const f = vi.hoisted(() => ({ capabilities: ['tenant.studio.render'], rpc: vi.fn() }));
const tenant = '10000000-0000-4000-8000-000000000218', series = '20000000-0000-4000-8000-000000000218', project = '30000000-0000-4000-8000-000000000218', job = '40000000-0000-4000-8000-000000000218', key = '50000000-0000-4000-8000-000000000218';
vi.mock('../../../../lib/control-session', () => ({ requireTenantControlSession: async () => ({ isLive: true, tenantId: tenant, capabilities: f.capabilities }) }));
vi.mock('../../../../lib/supabase/server', () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
const input = () => ({ seriesId: series, revision: 1, key, members: [{ id: project, draftRevision: 2, motion: false }] });
beforeEach(() => { f.capabilities = ['tenant.studio.render']; f.rpc.mockReset().mockResolvedValue({ data: { jobs: [{ projectId: project, jobId: job }] }, error: null }); });
it('uses one transactional exact-draft command with a stable retry identity', async () => { await expect(preparePublisherStudioSeries(input())).resolves.toEqual({ ok: true, jobs: [{ projectId: project, jobId: job }] }); expect(f.rpc).toHaveBeenCalledWith('prepare_publisher_studio_series_v1', { p_series_id: series, p_expected_revision: 1, p_members: [{ id: project, draftRevision: 2 }], p_idempotency_key: key }); });
it('reports an actual revision conflict without claiming success', async () => { f.rpc.mockResolvedValue({ data: null, error: { code: '40001' } }); await expect(preparePublisherStudioSeries(input())).resolves.toMatchObject({ ok: false, error: expect.stringContaining('gewijzigd') }); });
it('rejects a response for a different selected member', async () => { f.rpc.mockResolvedValue({ data: { jobs: [{ projectId: key, jobId: job }] }, error: null }); expect((await preparePublisherStudioSeries(input())).ok).toBe(false); });
it('requires render permission before preparing compatibility media', async () => { f.capabilities = []; expect((await preparePublisherStudioSeries(input())).ok).toBe(false); expect(f.rpc).not.toHaveBeenCalled(); });
it('prepares the selected Source draft through the separate transactional command',async()=>{
 f.rpc.mockResolvedValue({data:{projectId:project,jobId:job},error:null});
 const selected={projectId:project,draftRevision:3,key};
 await expect(preparePublisherSyncProject(selected)).resolves.toEqual({ok:true,jobs:[{projectId:project,jobId:job}]});
 await expect(preparePublisherSyncProject(selected)).resolves.toMatchObject({ok:true});
 expect(f.rpc.mock.calls).toEqual(Array.from({length:2},()=>['prepare_publisher_sync_project_v1',{p_project_id:project,p_expected_draft_revision:3,p_idempotency_key:key}]));
});
it('does not accept another Source project, a stale draft, or missing render permission',async()=>{
 const selected={projectId:project,draftRevision:3,key};
 f.rpc.mockResolvedValue({data:{projectId:series,jobId:job},error:null});expect((await preparePublisherSyncProject(selected)).ok).toBe(false);
 f.rpc.mockResolvedValue({data:null,error:{code:'40001'}});await expect(preparePublisherSyncProject(selected)).resolves.toMatchObject({ok:false,error:expect.stringContaining('gewijzigd')});
 f.rpc.mockClear();f.capabilities=[];expect((await preparePublisherSyncProject(selected)).ok).toBe(false);expect(f.rpc).not.toHaveBeenCalled();
});
