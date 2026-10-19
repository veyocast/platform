import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),available:true,enabled:true,campaign:null as null|Record<string,unknown>,options:[] as Array<{id:string;label:string;sort_order:number}>,reads:[] as Array<{table:string;select:string;filters:Array<unknown[]>}>}));
vi.mock('../../../../lib/control-session',()=>({requireTenantControlSession:f.session}));
vi.mock('../../../../lib/supabase/server',()=>({createControlSupabaseClient:async()=>f.available?{
 rpc:f.rpc,
 from(table:string){
  const read={table,select:'',filters:[] as Array<unknown[]>};f.reads.push(read);
  const query={select(value:string){read.select=value;return query;},eq(...values:unknown[]){read.filters.push(values);return query;},in(...values:unknown[]){read.filters.push(values);return query;},order(){return query;},
   maybeSingle:async()=>({error:null,data:table==='tenant_feature_flags'?{enabled:f.enabled}:f.campaign}),
   limit:async()=>({error:null,data:f.options}),
  };return query;
 },
}:null}));
import {readSyncEngageSelectionAction} from './sync-engage-actions';
const tenantId='26200000-0000-4000-8000-000000000001',campaignId='26200000-0000-4000-8000-000000000002',publicId='26200000-0000-4000-8000-000000000003';
const options=(count:number)=>Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i+100).padStart(12,'0')}`,label:`Speler ${i+1}`,sort_order:i}));
function publicCampaign(){return{id:publicId,kind:'motm',closesAt:null,privacyNotice:'Stemmen worden zonder naam geteld.',question:'Wie was de beste speler?',title:'Onze wedstrijd',resultVisibility:'live',resultsVisible:true,status:'live',tenantName:'Eigen club',totalVotes:f.options.reduce((sum,_,i)=>sum+i+1,0),options:f.options.map((option,i)=>({id:option.id,label:option.label,sortOrder:option.sort_order,voteCount:i+1}))};}
beforeEach(()=>{vi.clearAllMocks();f.available=true;f.enabled=true;f.reads=[];f.options=options(2);f.campaign={id:campaignId,public_id:publicId,title:'Onze wedstrijd',question:'Wie was de beste speler?',status:'live',result_visibility:'live'};f.session.mockResolvedValue({isLive:true,tenantId,capabilities:['tenant.dynamic_slide.read']});f.rpc.mockImplementation(async()=>({error:null,data:publicCampaign()}));vi.stubEnv('NEXT_PUBLIC_APP_URL','https://control.example.invalid');});
afterEach(()=>vi.unstubAllEnvs());
describe('complete policy-filtered Sync Engage selection',()=>{
 it.each([2,12,13,24])('reads all %i options in source order and freezes four choices per page',async count=>{
  f.options=options(count);const result=await readSyncEngageSelectionAction({publicId});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.poll).toMatchObject({id:publicId,optionsPerPage:4,publicUrl:`https://control.example.invalid/engage/${publicId}`,options:f.options.map((x,i)=>({id:x.id,label:x.label,votes:i+1}))});
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('get_engage_campaign_public_v1',{p_public_id:publicId});
  expect(f.reads.map(x=>x.select)).toEqual(['enabled','id,public_id,title,question,status,result_visibility','id,label,sort_order']);
  for(const read of f.reads)expect(read.filters).toContainEqual(['tenant_id',tenantId]);
 });
 it.each([1,25])('refuses %i answers without truncating or calling the public API',async count=>{
  f.options=options(count);const result=await readSyncEngageSelectionAction({publicId});expect(result.ok).toBe(false);expect(f.rpc).not.toHaveBeenCalled();
 });
 it.each(['after_vote','after_close'])('removes all nonpublic counts for %s on every option',async visibility=>{
  f.options=options(24);f.rpc.mockResolvedValue({error:null,data:{...publicCampaign(),resultsVisible:false,resultVisibility:visibility}});
  f.campaign!.result_visibility=visibility;
  const result=await readSyncEngageSelectionAction({publicId});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.poll?.visibility).toBe(visibility);expect(result.poll?.options.map(x=>x.votes)).toEqual(Array(24).fill(0));
 });
 it('uses only zero-valued metadata for a scheduled campaign before a public lifecycle exists',async()=>{
  f.options=options(24);f.campaign!.status='scheduled';f.campaign!.result_visibility='after_close';
  const result=await readSyncEngageSelectionAction({publicId});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.poll).toMatchObject({optionsPerPage:4,status:'scheduled',visibility:'after_close'});expect(result.poll?.options.map(x=>x.votes)).toEqual(Array(24).fill(0));expect(f.rpc).not.toHaveBeenCalled();
 });
 it('does not accept a foreign campaign, missing capability or disabled feature',async()=>{
  f.campaign=null;expect((await readSyncEngageSelectionAction({publicId})).ok).toBe(false);expect(f.rpc).not.toHaveBeenCalled();
  f.enabled=false;expect((await readSyncEngageSelectionAction({publicId})).ok).toBe(false);
  f.session.mockResolvedValue({isLive:true,tenantId,capabilities:[]});expect((await readSyncEngageSelectionAction({publicId})).ok).toBe(false);
 });
 it('rejects inconsistent public identities, incomplete counts and mismatched totals',async()=>{
  const base=publicCampaign();for(const data of[{...base,id:tenantId},{...base,totalVotes:100},{...base,options:base.options.map(({voteCount:_,...option})=>{void _;return option;})},{...base,options:[base.options[0],{...base.options[1],id:tenantId}]}]){
   f.rpc.mockResolvedValue({error:null,data});expect((await readSyncEngageSelectionAction({publicId})).ok).toBe(false);
  }
 });
});
