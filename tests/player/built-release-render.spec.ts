import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {expect,test} from "@playwright/test";
import {menuDocumentV2Schema,sitesCurrentPresentationSourceRevision,sitesDynamicConfigurationSchema,sitesPresentationSourceRevision} from "@veyocast/contracts";

const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tenant=id(1),snapshotId=id(2),versionId=id(3),templateId=id(4),releaseId=id(5);
const date="2026-10-14T12:00:00.000Z",checksum="a".repeat(64);
function fixture(kind:"menu-root"|"menu-nested"|"program-v17"|"program-v11",missingStorage=false){
 const menu=kind.startsWith("menu"),legacy=kind.endsWith("v11");
 const cfg=sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:legacy?"sites-v11":"sites-v17",sourceRevision:legacy?sitesPresentationSourceRevision:sitesCurrentPresentationSourceRevision,themeId:"onzetrots-tv",orientation:menu?"portrait":"landscape",provider:menu?"menu":"sportlink",title:menu?"Onze kantine":"Ons programma",...(menu?{menuWidgets:true}:{}),unifiedKind:menu?"kantine":"programma"});
 const document=menu?menuDocumentV2Schema.parse({schemaVersion:"menu-document.v2",id:"menu",tenantId:tenant,revision:1,createdAt:date,updatedAt:date,assets:[],theme:{themeId:"onzetrots-tv",themeVersion:"11.0.0",mode:"light",brand:{accent:"#03438a"}},sitesConfiguration:cfg,pages:[{id:"menu-page",order:0,blocks:[{id:"drinks",type:"category",order:0,layout:{landscape:{x:96,y:248,w:1728,h:696,rotation:0},portrait:{x:72,y:348,w:936,h:1380,rotation:0}},source:{source:"manual",sourceName:"Dranken",sourceCategoryId:"drinks"},productNodes:[{id:"coffee",kind:"product",order:0,productRef:{source:"manual",productId:"coffee",sourceRevision:"1"},snapshotFallback:{name:"Geverifieerde clubkoffie",available:true,price:{amountMinor:250,currency:"EUR",taxMode:"inclusive"}}}]}]}]}):null;
 const data={type:menu?"price_list":"sport_program",brand:{clubName:"Testclub"},sitesConfiguration:cfg,...(menu?(kind==="menu-root"?{menuDocument:document}:{priceList:{menuDocument:document}}):{sport:{items:[{id:"fixture",primary:"Testclub – Uitclub",homeTeam:"Testclub",awayTeam:"Uitclub",time:"14:00"}]}})};
 const item={id:id(6),source_item_id:id(7),live_data_enabled:true,asset_kind:"image",asset_title:"Gepubliceerd clubverhaal",display_title:null,duration_seconds:30,fit_mode:"contain",muted:true,transition:"cut",crop_focus_x:.5,crop_focus_y:.5,background_color:null,volume_percent:100,trim_start_seconds:0,trim_end_seconds:null,visible_from:null,visible_until:null,enabled:true,accessibility_name:null,section_source_id:null,section_name:null,section_position_key:null,storage_bucket:"tenant-media",storage_path:`tenants/${tenant}/assets/${id(8)}/frozen.png`,mime_type:"image/png",file_size_bytes:100,checksum_sha256:checksum,dynamic_snapshot_id:snapshotId,youtube_video_id:null,youtube_title:null,youtube_online_only:null,youtube_playlist_id:null,youtube_playlist_video_ids:null,youtube_playlist_repeat:null,sites_configuration_json:null,sites_studio_presentation_json:null,engage_public_id:null,engage_title:null,engage_question:null};
 return {missingStorage,target:{tenant_id:tenant,device_id:id(9),screen_id:id(10),screen_name:"Kantinescherm",desired_release_id:releaseId,active_release_id:null,target_revision:"1",composition:null},tables:{
  playlist_releases:[{id:releaseId,tenant_id:tenant,playlist_id:id(11),version:1,manifest_hash:checksum,manifest_json:{},published_at:date,total_duration_seconds:30,total_bytes:100}],playlist_release_items:[item],
  dynamic_slide_snapshots:[{id:snapshotId,source_revision_hash:checksum,snapshot_data_json:data,template_version_id:versionId,dynamic_slide_version_id:id(12)}],
  published_dynamic_data:[{snapshot_id:snapshotId,content_hash:checksum,data_json:data,data_revision:1,changed_at:date,last_error_code:null}],
  dynamic_template_versions:[{id:versionId,template_id:templateId}],dynamic_templates:[{id:templateId,slug:menu?"price-list":"sport-program",slide_type:data.type,orientation:cfg.orientation}]
 }};
}
for(const kind of ["menu-root","menu-nested","program-v17","program-v11"] as const){
 test(`the built manifest renders ${kind} without invoking a browser component on the server`,async({request})=>{
  // Compiles the route when this gate uses a development Next server.
  await request.get(`http://127.0.0.1:${process.env.PLAYER_PORT??3106}/api/player/manifest`);
  const result=probe(fixture(kind));expect(result.status).toBe(200);expect(result.body.manifest.items[0].sitesPresentation.pages).toHaveLength(1);
  const html=result.body.manifest.items[0].sitesPresentation.pages.join("");expect(html).not.toMatch(/(?:src|href)="https?:/);
  expect(html).toContain(kind.startsWith("menu")?"Geverifieerde clubkoffie":"Uitclub");
  if(kind.startsWith("menu")){expect(html).toContain("vm-widget");expect(html).toContain("TESTCLUB");}
 });
}
test("the built manifest refuses an actually unavailable release asset",async({request})=>{
 await request.get(`http://127.0.0.1:${process.env.PLAYER_PORT??3106}/api/player/manifest`);
 const result=probe(fixture("menu-root",true));expect(result.status).toBe(503);expect(result.body.error.code).toBe("RELEASE_ASSETS_UNAVAILABLE");expect(result.body.manifest).toBeUndefined();
});
function probe(value:ReturnType<typeof fixture>){
 const directory=mkdtempSync(join(tmpdir(),"veyocast-built-release-")),path=join(directory,"fixture.json");
 try{writeFileSync(path,JSON.stringify(value),{mode:0o600});return JSON.parse(execFileSync(process.execPath,[resolve("tests/helpers/probe-built-player-release.cjs"),resolve("apps/player/.next/server/app/api/player/manifest/route.js"),path],{encoding:"utf8",timeout:20000,maxBuffer:4*1024*1024}));}
 finally{rmSync(directory,{recursive:true,force:true});}
}
