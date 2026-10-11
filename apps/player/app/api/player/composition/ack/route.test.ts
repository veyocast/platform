import {beforeEach,describe,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
const fixture=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../_lib/player-supabase",()=>({createPlayerAdminClient:()=>({rpc:fixture.rpc})}));
import {POST} from "./route";
const token="paired-composition-device-token";
const body={compositionId:"10000000-0000-4000-8000-000000191231",targetRevision:"27"};
const request=(data:unknown=body,authorization=`Bearer ${token}`)=>new Request("https://player.veyocast.test/api/player/composition/ack",{method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify(data)});
beforeEach(()=>fixture.rpc.mockReset());
describe("device-scoped composition proof",()=>{
 it("requires a valid paired-device credential and bounded proof before any database call",async()=>{expect((await POST(request(body,""))).status).toBe(401);expect((await POST(request({...body,targetRevision:"invalid"}))).status).toBe(400);expect(fixture.rpc).not.toHaveBeenCalled();});
 it("submits only the credential hash and exact composition CAS",async()=>{fixture.rpc.mockResolvedValue({data:true,error:null});expect((await POST(request())).status).toBe(200);expect(fixture.rpc).toHaveBeenCalledWith("acknowledge_player_composition_v1",{p_token_hash:createHash("sha256").update(token).digest("hex"),p_composition_id:body.compositionId,p_target_revision:"27"});});
 it("does not acknowledge a stale target or expose a database failure",async()=>{fixture.rpc.mockResolvedValueOnce({data:false,error:null}).mockResolvedValueOnce({data:null,error:{message:"secret URL and stack trace"}});expect((await POST(request())).status).toBe(409);const failed=await POST(request());expect(failed.status).toBe(503);expect(await failed.text()).toBe('{"error":"PLAYER_API_UNAVAILABLE"}');});
});
