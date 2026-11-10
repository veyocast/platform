import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({session:{} as Record<string,unknown>,rpc:vi.fn(),client:vi.fn(),revalidate:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./control-session",()=>({requireControlSession:async()=>mock.session}));
vi.mock("./supabase/server",()=>({createControlSupabaseClient:mock.client}));
vi.mock("next/cache",()=>({revalidatePath:mock.revalidate}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw Error(`redirect:${path}`);}}));
import {applyMatchdayActionCommand as rawApply,loadMatchdayWorkspace,publishMatchdayCommand as rawPublish,setMatchdayEnabledCommand as rawSet,previewMatchdayCommand} from "./matchday-service";
import workspaceFixture from "../../../tests/fixtures/s300-matchday-rpc.json";
const uuid=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const actorScope=`${uuid(1)}:${uuid(101)}`;
const applyMatchdayActionCommand=(input:unknown)=>rawApply(input,actorScope);
const publishMatchdayCommand=(input:unknown)=>rawPublish(input,actorScope);
const setMatchdayEnabledCommand=(input:unknown)=>rawSet(input,actorScope);
const input=()=>({runbookId:uuid(6),publicationId:uuid(2),expectedRevision:3,requestId:uuid(3),screenIds:[uuid(4)],endsAt:"2026-11-09T14:00:00Z",reason:"Veldverdeling aangepast",kind:"field",matchId:uuid(5),field:"2"});
beforeEach(()=>{vi.clearAllMocks();mock.session={isLive:true,tenantId:uuid(1),userId:uuid(101),tenantMemberships:[{id:uuid(1)}],tenantStatus:"active",capabilities:[]};mock.client.mockResolvedValue({rpc:mock.rpc});mock.rpc.mockResolvedValue({data:{outcome:"applied",requestId:uuid(3),runbookId:uuid(6),publicationId:uuid(2),actionId:uuid(7),actualRevision:4,message:"Klaargezet; wacht op Playerbewijs."},error:null});});
describe("S300 ordinary authenticated service boundary",()=>{
 it("loads the authorized workspace when an untargeted screen has no measured resolution",async()=>{
  const workspace=structuredClone(workspaceFixture["workspace-before-publish"]);
  const other={...workspace.options.screens[0]!,id:uuid(999),width:null,height:null};
  mock.rpc.mockResolvedValue({data:{...workspace,options:{...workspace.options,screens:[...workspace.options.screens,other]}},error:null});
  const result=await loadMatchdayWorkspace(null,"2026-11-10");
  expect(result).toMatchObject({ok:true,workspace:{options:{screens:expect.arrayContaining([expect.objectContaining({id:uuid(999),width:null,height:null})])}}});
  expect(mock.rpc).toHaveBeenCalledWith("get_matchday_workspace_s300_v1",{p_tenant_id:uuid(1),p_runbook_id:null,p_day:"2026-11-10"});
 });
 it("blocks an old actor/tenant closure before its retry can reach another current tenant",async()=>{
  await applyMatchdayActionCommand(input());mock.rpc.mockClear();mock.client.mockClear();
  mock.session.userId=uuid(102);
  expect(await applyMatchdayActionCommand(input())).toMatchObject({ok:false,code:"FORBIDDEN"});
  mock.session.userId=uuid(101);mock.session.tenantId=uuid(9);mock.session.tenantMemberships=[{id:uuid(9)}];
  expect(await setMatchdayEnabledCommand({enabled:false,expectedRevision:1,requestId:uuid(3),reason:"Pilot afsluiten"})).toMatchObject({ok:false,code:"FORBIDDEN"});
  expect(mock.client).not.toHaveBeenCalled();expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("rejects omitted actor bindings and actor-switched preflight before any RPC",async()=>{
  expect(await rawApply(input(),undefined as unknown as string)).toMatchObject({ok:false,code:"FORBIDDEN"});
  mock.session.capabilities=["tenant.playlist.write"];mock.session.userId=uuid(102);
  expect(await previewMatchdayCommand(uuid(6),1,actorScope)).toMatchObject({ok:false,code:"FORBIDDEN"});expect(mock.rpc).not.toHaveBeenCalled();
 });
 it.each(["requestId","runbookId","publicationId"])("does not accept a structurally valid receipt for another %s",async key=>{
  const receipt={outcome:"applied",requestId:uuid(3),runbookId:uuid(6),publicationId:uuid(2),actionId:uuid(7),actualRevision:4,message:"Klaargezet"};
  mock.rpc.mockResolvedValue({data:{...receipt,[key]:uuid(999)},error:null});
  expect(await applyMatchdayActionCommand(input())).toMatchObject({ok:false,code:"UNAVAILABLE"});expect(mock.revalidate).not.toHaveBeenCalled();
 });
 it("denies foreign tenant selection before creating a database client",async()=>{mock.session.tenantMemberships=[{id:uuid(99)}];expect(await applyMatchdayActionCommand(input())).toMatchObject({ok:false,code:"FORBIDDEN"});expect(mock.client).not.toHaveBeenCalled();});
 it("does not turn delegation into a global publishing capability",async()=>{expect(await publishMatchdayCommand({runbookId:uuid(6),expectedRevision:3,requestId:uuid(3),preflightId:uuid(8)})).toMatchObject({ok:false,code:"FORBIDDEN"});expect(mock.rpc).not.toHaveBeenCalled();});
 it("passes an exact delegated command through the transactional object/target guard, preserving its nonce",async()=>{await applyMatchdayActionCommand(input());await applyMatchdayActionCommand(input());expect(mock.rpc).toHaveBeenNthCalledWith(1,"apply_matchday_action_s300_v1",{p_tenant_id:uuid(1),p_input:input()});expect(mock.rpc).toHaveBeenNthCalledWith(2,"apply_matchday_action_s300_v1",{p_tenant_id:uuid(1),p_input:input()});});
 it("blocks inactive tenants and malformed or all-screen commands before any RPC",async()=>{expect(await applyMatchdayActionCommand({...input(),screenIds:[]})).toMatchObject({ok:false,code:"VALIDATION"});mock.session.tenantStatus="suspended";expect(await applyMatchdayActionCommand(input())).toMatchObject({ok:false,code:"FORBIDDEN"});expect(mock.rpc).not.toHaveBeenCalled();});
 it("returns CAS conflict without leaking database/provider details",async()=>{mock.rpc.mockResolvedValue({data:null,error:{code:"40001",message:"secret-provider-internal"}});const result=await applyMatchdayActionCommand(input());expect(result).toMatchObject({ok:false,code:"CONFLICT"});expect(JSON.stringify(result)).not.toContain("secret-provider-internal");});
 it("does not claim success for a malformed receipt or partial workspace",async()=>{mock.rpc.mockResolvedValue({data:{outcome:"applied"},error:null});expect(await applyMatchdayActionCommand(input())).toMatchObject({ok:false,code:"UNAVAILABLE"});expect(await loadMatchdayWorkspace(null,null)).toMatchObject({ok:false,code:"UNAVAILABLE"});});
 it("does not invoke a service-role client or a provider write when the pilot is toggled",async()=>{mock.session.capabilities=["tenant.settings.manage"];mock.rpc.mockResolvedValue({data:{outcome:"applied",requestId:uuid(3),runbookId:null,publicationId:null,actionId:null,actualRevision:1,message:"Herstel klaargezet."},error:null});expect(await setMatchdayEnabledCommand({enabled:false,expectedRevision:0,requestId:uuid(3),reason:"Pilot afsluiten"})).toMatchObject({ok:true});expect(mock.rpc).toHaveBeenCalledWith("set_matchday_enabled_s300_v1",{p_tenant_id:uuid(1),p_input:{enabled:false,expectedRevision:0,requestId:uuid(3),reason:"Pilot afsluiten"}});});
});
