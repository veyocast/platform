import {beforeEach,describe,expect,it,vi}from'vitest';
const f=vi.hoisted(()=>({capability:vi.fn(),client:vi.fn(),rpc:vi.fn(),from:vi.fn(),eq:vi.fn(),revalidate:vi.fn(),scoped:vi.fn()}));
vi.mock('../../../../lib/control-session',()=>({requireTenantCapability:f.capability}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:f.client}));
vi.mock('next/cache',()=>({revalidatePath:f.revalidate}));
import {savePlaylistBatch}from'./sites-batch-actions';
const id=(n:number)=>`19130000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const command={playlistId:id(1),expectedRevision:7,idempotencyKey:id(2),operations:[{operation:'patch'as const,itemId:id(3),patch:{durationSeconds:3}}]};
beforeEach(()=>{vi.clearAllMocks();f.capability.mockResolvedValue({isLive:true,tenantId:id(10),userId:id(20)});f.client.mockResolvedValue({rpc:f.rpc,from:f.from});const query={select:()=>query,eq:(...args:unknown[])=>{f.eq(...args);return query;},maybeSingle:f.scoped};f.from.mockReturnValue(query);f.scoped.mockResolvedValue({data:{id:id(1)},error:null});f.rpc.mockResolvedValue({data:{outcome:'applied',actualRevision:8,itemIds:{}},error:null});});
describe('active tenant playlist transport and server acknowledgement',()=>{
 it('checks the active tenant even when a human belongs to both associations',async()=>{f.scoped.mockResolvedValue({data:null,error:null});expect((await savePlaylistBatch(command)).outcome).toBe('failed');expect(f.eq).toHaveBeenCalledWith('tenant_id',id(10));expect(f.eq).toHaveBeenCalledWith('id',id(1));expect(f.rpc).not.toHaveBeenCalled();});
 it('sends the original revision, idempotency key and narrow patch after authorization',async()=>{expect(await savePlaylistBatch(command)).toEqual({outcome:'applied',actualRevision:8,itemIds:{}});expect(f.capability).toHaveBeenCalledWith('tenant.playlist.write','mutate');expect(f.rpc).toHaveBeenCalledWith('mutate_playlist_batch_v1',{p_playlist_id:id(1),p_expected_revision:7,p_operations:command.operations,p_idempotency_key:id(2)});});
 it('returns a conflict without clearing or revalidating the concept',async()=>{f.rpc.mockResolvedValue({data:{outcome:'conflict',actualRevision:9},error:null});expect(await savePlaylistBatch(command)).toEqual({outcome:'conflict',actualRevision:9});expect(f.revalidate).not.toHaveBeenCalled();});
 it('fails closed when a server response has no complete acknowledgement',async()=>{f.rpc.mockResolvedValue({data:{outcome:'applied',actualRevision:8},error:null});expect((await savePlaylistBatch(command)).outcome).toBe('failed');expect(f.revalidate).not.toHaveBeenCalled();});
 it('rejects oversized commands before querying any tenant data',async()=>{const input={...command,operations:[{operation:'details'as const,name:'Valid name',description:'x'.repeat(300000)}]};expect((await savePlaylistBatch(input)).outcome).toBe('failed');expect(f.from).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();});
 it('does not reveal provider or database details on a failed transaction',async()=>{f.rpc.mockResolvedValue({data:null,error:{code:'XX000',message:'private provider credential details'}});const result=await savePlaylistBatch(command);expect(result.outcome).toBe('failed');expect(JSON.stringify(result)).not.toContain('credential');expect(f.revalidate).not.toHaveBeenCalled();});
 it('binds a new workspace command to the exact fresh actor before client or RPC access',async()=>{
  expect((await savePlaylistBatch(command,`${id(10)}:${id(20)}`)).outcome).toBe('applied');
  f.client.mockClear();f.rpc.mockClear();f.capability.mockResolvedValue({isLive:true,tenantId:id(10),userId:id(21)});
  expect(await savePlaylistBatch(command,`${id(10)}:${id(20)}`)).toMatchObject({outcome:'failed',uncertain:true});
  expect(f.client).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
 });
 it('does not accept a caller scope manufactured from a missing actor identity',async()=>{
  f.capability.mockResolvedValue({isLive:true,tenantId:id(10)});
  expect((await savePlaylistBatch(command,`${id(10)}:undefined`)).outcome).toBe('failed');expect(f.client).not.toHaveBeenCalled();
 });
 it('separates a definitive PT409 rejection from an unknown transport outcome without changing the nonce',async()=>{
  f.rpc.mockResolvedValueOnce({data:null,error:{code:'PT409'}}).mockResolvedValueOnce({data:null,error:{code:'57014'}});
  expect(await savePlaylistBatch(command,`${id(10)}:${id(20)}`)).toMatchObject({outcome:'failed',uncertain:false});
  const unknown=await savePlaylistBatch(command,`${id(10)}:${id(20)}`);expect(unknown.outcome).toBe('failed');expect(unknown).not.toHaveProperty('uncertain',false);
  expect(f.rpc.mock.calls[0]).toEqual(f.rpc.mock.calls[1]);expect(f.revalidate).not.toHaveBeenCalled();
 });
});
