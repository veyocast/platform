import {beforeEach,describe,expect,it,vi} from "vitest";
import {loadPublisherLibrary} from "./library";
import {studioSitesSystemTemplates,createSyncStudioStarter} from "@veyocast/studio";
const fixture=vi.hoisted(()=>({wrongColumn:false,studioData:{} as unknown,syncData:{} as unknown,syncError:false,rpcs:[] as string[],queries:[] as Array<{table:string;columns:string;tenant?:string}>}));
const tenant="10000000-0000-4000-8000-000000000217",slideId="20000000-0000-4000-8000-000000000217",snapshotId="30000000-0000-4000-8000-000000000217",hash="a".repeat(64);
vi.mock("../../../../lib/supabase/server",()=>({createControlSupabaseClient:async()=>({
 rpc(name:string){fixture.rpcs.push(name);return Promise.resolve({data:name==='list_publisher_sync_studio_v1'?fixture.syncData:fixture.studioData,error:name==='list_publisher_sync_studio_v1'&&fixture.syncError?{code:'57014'}:null});},
 from(table:string){const query={table,columns:"",unavailable:false,tenant:undefined as string|undefined};fixture.queries.push(query);
  const builder={select(columns:string){query.columns=columns;return builder;},eq(key:string,value:string){if(key==="tenant_id")query.tenant=value;return builder;},not(key:string){if(key==="status")query.unavailable=true;return builder;},is:()=>builder,in:()=>builder,order:()=>builder,range:()=>builder,limit:()=>builder,
   then(resolve:(value:unknown)=>unknown){const unavailable=table==="dynamic_slide_snapshots"&&(fixture.wrongColumn||query.columns.split(",").includes("snapshot_hash"));
    const data=table==="dynamic_slides"?(query.unavailable?[]:[{id:slideId,name:"Opgeslagen menu",slide_type:"menu",orientation:"landscape",current_snapshot_id:snapshotId}]):table==="dynamic_slide_snapshots"?[{id:snapshotId,dynamic_slide_id:slideId,template_version_id:"40000000-0000-4000-8000-000000000217",source_revision_hash:hash,snapshot_data_json:{menu:{title:"Kantine",products:[{id:"coffee",name:"Clubkoffie",category:"Warm",priceMinor:250}]}},status:"ready"}]:[];
    return Promise.resolve({data:unavailable?null:data,error:unavailable?{code:"42703"}:null,count:1}).then(resolve);
   }};return builder;
 }} )}));
beforeEach(()=>{fixture.queries=[];fixture.rpcs=[];fixture.wrongColumn=false;fixture.studioData={total:0,series:[]};fixture.syncData={total:0,projects:[]};fixture.syncError=false;});
describe("Clubverhaal canonical slide library",()=>{
 it("loads the actual stored snapshot hash and rows through tenant-scoped queries",async()=>{
  const page=await loadPublisherLibrary(tenant,{tab:"dynamic"});expect(page.designs).toHaveLength(1);expect(page.designs[0]).toMatchObject({id:slideId,snapshotId,payload:{snapshotHash:hash},rows:[{primary:"Clubkoffie"}]});
  expect(fixture.queries.find(query=>query.table==="dynamic_slide_snapshots")).toMatchObject({tenant,columns:expect.stringContaining("source_revision_hash")});
 });
 it("reports a failed database read instead of returning an empty library",async()=>{
  fixture.wrongColumn=true;await expect(loadPublisherLibrary(tenant,{tab:"dynamic"})).rejects.toThrow("ontwerpinhoud");
 });
 it("shows saved HTML designs without requiring an exported PNG, together with menu slides",async()=>{
  const document=studioSitesSystemTemplates.find(template=>template.category==='welcome')!.document;
  fixture.studioData={total:1,series:[{id:slideId,name:'Clubverhaal',revision:1,members:[{projectId:snapshotId,name:'Welkom',document,draftRevision:3,exportId:null,mediaAssetId:null,outputKind:null}]}]};
  const page=await loadPublisherLibrary(tenant,{tab:'slides'});
  expect(fixture.rpcs).toEqual(['list_publisher_studio_series_v2','list_publisher_sync_studio_v1']);
  expect(page.projects).toHaveLength(1);expect(page.designs).toHaveLength(1);expect(page.total).toBe(2);
  expect(page.projects[0]!.slides[0]).toMatchObject({id:snapshotId,draftRevision:3});
  expect(page.projects[0]!.slides[0]!.exportId).toBeUndefined();
 });
 it("does not read Studio data when only dynamic-slide permission was granted",async()=>{
  const page=await loadPublisherLibrary(tenant,{tab:'slides'},{studio:false,dynamic:true});expect(page.designs).toHaveLength(1);expect(fixture.rpcs).toEqual([]);
 });
 it('keeps saved Source projects visible before export without inventing a ready fallback',async()=>{
  const document=createSyncStudioStarter({family:'club-story',tenantName:'Club A'});
  fixture.syncData={total:1,projects:[{id:slideId,name:'Ons verhaal',kind:'project',revision:1,members:[{projectId:slideId,name:'Ons verhaal',draftRevision:0,document,exportId:null,mediaAssetId:null,outputKind:null,checksumSha256:null,bytes:null}]}]};
  const page=await loadPublisherLibrary(tenant,{tab:'slides'});
  expect(page.syncProjects).toHaveLength(1);expect(page.total).toBe(2);
  expect(page.syncProjects?.[0]?.members[0]).toMatchObject({id:slideId,exportKind:'video',durationSeconds:12,presentation:{rendererVersion:'sync-v1'}});
  expect(page.syncProjects?.[0]?.members[0]?.exportAssetId).toBeUndefined();
 });
 it('returns only complete verified Source export identities and refuses a mismatched output kind',async()=>{
  const document=createSyncStudioStarter({family:'club-story',tenantName:'Club A'}),member={projectId:slideId,name:'Ons verhaal',draftRevision:0,document,exportId:snapshotId,mediaAssetId:'40000000-0000-4000-8000-000000000217',outputKind:'mp4',checksumSha256:hash,bytes:10000};
  fixture.syncData={total:1,projects:[{id:slideId,name:'Ons verhaal',kind:'project',revision:1,members:[member]}]};
  const page=await loadPublisherLibrary(tenant,{tab:'studio'});expect(page.syncProjects?.[0]?.members[0]).toMatchObject({exportId:snapshotId,exportAssetId:member.mediaAssetId,checksumSha256:hash});
  member.outputKind='png';await expect(loadPublisherLibrary(tenant,{tab:'studio'})).rejects.toThrow('Source-uitvoer');
 });
 it('fails a partial Source read without reporting an empty or complete library',async()=>{
  fixture.syncError=true;await expect(loadPublisherLibrary(tenant,{tab:'studio'})).rejects.toThrow('Source-ontwerpen');
 });
});
