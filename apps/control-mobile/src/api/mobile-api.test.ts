import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {mobileApi,MobileApiError} from "./mobile-api";
import type {PlaylistBatchCommand} from "@veyocast/contracts";
import {createSyncStudioStarter, type MobileSyncStudioRequestV3} from "@veyocast/studio/mobile-v3";
const state=vi.hoisted(()=>({token:"test-only-session-token",userId:"10000000-0000-4000-8000-000000191281",gate:null as Promise<void>|null,fetch:vi.fn()}));
vi.mock("../config/runtime",()=>({readMobileRuntimeConfig:()=>({config:{controlOrigin:"https://control.example.test",supabaseUrl:"https://db.example.test",supabaseAnonKey:"public-test-configuration"},error:null})}));
vi.mock("../auth/supabase",()=>({mobileSupabase:{auth:{getSession:async()=>{await state.gate;return{data:{session:state.token?{access_token:state.token,user:{id:state.userId}}:null}}}}}}));
const tenantId="10000000-0000-4000-8000-000000191281";
const command:PlaylistBatchCommand={playlistId:"20000000-0000-4000-8000-000000191281",expectedRevision:7,idempotencyKey:"30000000-0000-4000-8000-000000191281",operations:[{operation:"patch",itemId:"40000000-0000-4000-8000-000000191281",patch:{displayTitle:"Mijn plaatsing"}}]};
const confirmed=()=>new Response(JSON.stringify({data:{outcome:"applied",actualRevision:8,itemIds:{}},meta:{version:"2",requestId:"test-request"}}),{status:200});
beforeEach(()=>{state.token="test-only-session-token";state.userId="10000000-0000-4000-8000-000000191281";state.gate=null;state.fetch.mockReset();vi.stubGlobal("fetch",state.fetch);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe("native v2 authenticated acknowledgement transport",()=>{
 it("does not send an API request without an existing signed-in session",async()=>{state.token="";await expect(mobileApi.mutatePlaylistBatchV2(tenantId,command)).rejects.toMatchObject({code:"UNAUTHENTICATED",status:401});expect(state.fetch).not.toHaveBeenCalled();});
 it("retains the exact idempotency key, patch and revision across an uncertain network result",async()=>{state.fetch.mockRejectedValueOnce(Error("PRIVATE_PROVIDER_VALUE")).mockResolvedValueOnce(confirmed());await expect(mobileApi.mutatePlaylistBatchV2(tenantId,command)).rejects.toMatchObject({code:"NETWORK_UNAVAILABLE"});expect(await mobileApi.mutatePlaylistBatchV2(tenantId,command)).toMatchObject({outcome:"applied",actualRevision:8});const first=state.fetch.mock.calls[0]![1]as RequestInit,second=state.fetch.mock.calls[1]![1]as RequestInit;expect(first.body).toBe(second.body);expect(JSON.parse(String(second.body))).toEqual(command);expect(second.headers).toMatchObject({"X-VeyoCast-Tenant-Id":tenantId,Authorization:"Bearer test-only-session-token"});expect(state.fetch.mock.calls[1]![0]).toBe(`https://control.example.test/api/mobile/v2/playlists/${command.playlistId}`);});
 it("bounds a hanging response body as well as the initial network connection",async()=>{vi.useFakeTimers();const response=confirmed();response.json=()=>new Promise(()=>undefined);state.fetch.mockResolvedValue(response);const result=mobileApi.mutatePlaylistBatchV2(tenantId,command);const rejection=expect(result).rejects.toMatchObject({code:"NETWORK_UNAVAILABLE",status:503});await vi.advanceTimersByTimeAsync(30_001);await rejection;expect((state.fetch.mock.calls[0]![1]as RequestInit).signal?.aborted).toBe(true);});
 it("does not treat an unconfirmed or older response contract as saved",async()=>{state.fetch.mockResolvedValue(new Response(JSON.stringify({data:{outcome:"applied",actualRevision:8,itemIds:{}},meta:{requestId:"test",version:"1"}}),{status:200}));await expect(mobileApi.mutatePlaylistBatchV2(tenantId,command)).rejects.toBeInstanceOf(MobileApiError);await expect(mobileApi.mutatePlaylistBatchV2(tenantId,command)).rejects.toMatchObject({code:"API_CONTRACT_MISMATCH"});});
});

describe("native Sync v3 transport",()=>{
 it("retries the full Sync document with the original command identity without a Sites conversion",async()=>{
  const input:MobileSyncStudioRequestV3={operation:"save",projectId:command.playlistId,expectedDraftRevision:7,idempotencyKey:command.idempotencyKey,document:createSyncStudioStarter({family:"club-story",tenantName:"Mijn vereniging",orientation:"portrait",theme:"onzetrots-tv"})};
  state.fetch.mockRejectedValueOnce(Error("network interrupted")).mockResolvedValueOnce(new Response(JSON.stringify({data:{outcome:"saved",projectId:input.projectId,draftRevision:8,renderJobId:null,series:null},meta:{version:"3",requestId:"sync-test"}}),{status:200}));
  await expect(mobileApi.mutateStudioV3(tenantId,input,state.userId)).rejects.toMatchObject({code:"NETWORK_UNAVAILABLE"});
  await expect(mobileApi.mutateStudioV3(tenantId,input,state.userId)).resolves.toMatchObject({outcome:"saved",draftRevision:8});
  expect(state.fetch.mock.calls[0]![1].body).toBe(state.fetch.mock.calls[1]![1].body);
  expect(JSON.parse(state.fetch.mock.calls[1]![1].body)).toEqual(input);
  expect(state.fetch.mock.calls[1]![0]).toBe("https://control.example.test/api/mobile/v3/studio");
 });

 it("does not send a previous actor's journal after a delayed session lookup returns a different account",async()=>{
  let release!:()=>void;state.gate=new Promise<void>(resolve=>{release=resolve;});
  const expected=state.userId;
  const request=mobileApi.mutateStudioV3(tenantId,{operation:"render",projectId:command.playlistId,expectedDraftRevision:7,outputKind:"mp4",idempotencyKey:command.idempotencyKey},expected);
  state.userId="90000000-0000-4000-8000-000000191281";release();
  await expect(request).rejects.toMatchObject({code:"AUTH_CONTEXT_CHANGED",status:401});
  expect(state.fetch).not.toHaveBeenCalled();
 });
 it("refuses an older envelope for a Sync mutation instead of treating it as success",async()=>{
  state.fetch.mockResolvedValue(confirmed());
  await expect(mobileApi.mutateStudioV3(tenantId,{operation:"render",projectId:command.playlistId,expectedDraftRevision:7,outputKind:"mp4",idempotencyKey:command.idempotencyKey},state.userId)).rejects.toMatchObject({code:"API_CONTRACT_MISMATCH"});
 });
});
