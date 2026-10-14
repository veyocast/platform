import {beforeEach,describe,expect,it,vi} from "vitest";
import {loadPublisherLibrary} from "./library";
const fixture=vi.hoisted(()=>({wrongColumn:false,queries:[] as Array<{table:string;columns:string;tenant?:string}>}));
const tenant="10000000-0000-4000-8000-000000000217",slideId="20000000-0000-4000-8000-000000000217",snapshotId="30000000-0000-4000-8000-000000000217",hash="a".repeat(64);
vi.mock("../../../../lib/supabase/server",()=>({createControlSupabaseClient:async()=>({
 from(table:string){const query={table,columns:"",tenant:undefined as string|undefined};fixture.queries.push(query);
  const builder={select(columns:string){query.columns=columns;return builder;},eq(key:string,value:string){if(key==="tenant_id")query.tenant=value;return builder;},in:()=>builder,order:()=>builder,range:()=>builder,limit:()=>builder,
   then(resolve:(value:unknown)=>unknown){const unavailable=table==="dynamic_slide_snapshots"&&(fixture.wrongColumn||query.columns.split(",").includes("snapshot_hash"));
    const data=table==="dynamic_slides"?[{id:slideId,name:"Opgeslagen menu",slide_type:"menu",orientation:"landscape",current_snapshot_id:snapshotId}]:table==="dynamic_slide_snapshots"?[{id:snapshotId,dynamic_slide_id:slideId,template_version_id:"40000000-0000-4000-8000-000000000217",source_revision_hash:hash,snapshot_data_json:{menu:{title:"Kantine",products:[{id:"coffee",name:"Clubkoffie",category:"Warm",priceMinor:250}]}},status:"ready"}]:[];
    return Promise.resolve({data:unavailable?null:data,error:unavailable?{code:"42703"}:null,count:1}).then(resolve);
   }};return builder;
 }} )}));
beforeEach(()=>{fixture.queries=[];fixture.wrongColumn=false;});
describe("Clubverhaal canonical slide library",()=>{
 it("loads the actual stored snapshot hash and rows through tenant-scoped queries",async()=>{
  const page=await loadPublisherLibrary(tenant,{tab:"dynamic"});expect(page.designs).toHaveLength(1);expect(page.designs[0]).toMatchObject({id:slideId,snapshotId,payload:{snapshotHash:hash},rows:[{primary:"Clubkoffie"}]});
  expect(fixture.queries.find(query=>query.table==="dynamic_slide_snapshots")).toMatchObject({tenant,columns:expect.stringContaining("source_revision_hash")});
 });
 it("reports a failed database read instead of returning an empty library",async()=>{
  fixture.wrongColumn=true;await expect(loadPublisherLibrary(tenant,{tab:"dynamic"})).rejects.toThrow("ontwerpinhoud");
 });
});
