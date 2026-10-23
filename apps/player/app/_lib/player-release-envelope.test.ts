import { describe, expect, it, vi } from "vitest";
import {syncSlidePresentationSchema} from "@veyocast/contracts";
import {assertSyncPlayerAssetManifest} from "./sync-player-assets";
const fixture=vi.hoisted(()=>({admin:null as unknown}));
vi.mock("./player-supabase",()=>({createPlayerAdminClient:()=>fixture.admin}));

import { buildDynamicTemplatePayloadMap } from "./player-dynamic-template-payload";
import { collectDynamicSnapshotMediaAssetIds, loadPlayerReleaseEnvelope } from "./player-release-envelope";

describe("dynamic template release payload", () => {
  it("bindt een immutable snapshot aan de gepubliceerde platformtemplate", () => {
    const snapshotId = "11111111-1111-4111-8111-111111111111";
    const versionId = "22222222-2222-4222-8222-222222222222";
    const templateId = "33333333-3333-4333-8333-333333333333";
    const payloads = buildDynamicTemplatePayloadMap({
      snapshots: [
        {
          id: snapshotId,
          snapshot_data_json: {
            news: { articles: [], sourceName: "Clubnieuws" },
            type: "news"
          },
          source_revision_hash: "b".repeat(64),
          template_version_id: versionId
        }
      ],
      templates: [
        {
          id: templateId,
          orientation: "landscape",
          slide_type: "news",
          slug: "editorial-arena-nieuws-dark-landscape"
        }
      ],
      versions: [{ id: versionId, template_id: templateId }]
    });

    expect(payloads.get(snapshotId)).toMatchObject({
      orientation: "landscape",
      slideType: "news",
      snapshotHash: "b".repeat(64),
      templateSlug: "editorial-arena-nieuws-dark-landscape"
    });
  });

  it("laat een snapshot zonder bekende platformtemplate weg", () => {
    const payloads = buildDynamicTemplatePayloadMap({
      snapshots: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          snapshot_data_json: {},
          source_revision_hash: "c".repeat(64),
          template_version_id: "22222222-2222-4222-8222-222222222222"
        }
      ],
      templates: [],
      versions: []
    });

    expect(payloads.size).toBe(0);
  });

  it('never projects a new Source snapshot through the historical dynamic DOM identity',()=>{
    const templateId='33333333-3333-4333-8333-333333333333',versionId='22222222-2222-4222-8222-222222222222';
    const common={source_revision_hash:'a'.repeat(64),template_version_id:versionId};
    const payloads=buildDynamicTemplatePayloadMap({snapshots:[{...common,id:'11111111-1111-4111-8111-111111111111',snapshot_data_json:{type:'news',syncConfiguration:{rendererVersion:'sync-v1'},news:{articles:[]}}},{...common,id:'44444444-4444-4444-8444-444444444444',snapshot_data_json:{type:'news',news:{articles:[]}}}],templates:[{id:templateId,orientation:'landscape',slide_type:'news',slug:'editorial-arena-nieuws-dark-landscape'}],versions:[{id:versionId,template_id:templateId}]});
    expect([...payloads.keys()]).toEqual(['44444444-4444-4444-8444-444444444444']);
  });

  it("verzamelt alleen begrensde UUID-mediareferenties uit HTML/CSS-snapshots", () => {
    expect(collectDynamicSnapshotMediaAssetIds({
      brand: {
        logoMediaAssetId: "55555555-5555-4555-8555-555555555555"
      },
      menu: {
        products: [
          {
            imageMediaAssetId: "66666666-6666-4666-8666-666666666666"
          }
        ]
      },
      priceList: {
        sections: [{
          products: [
            {
              imageMediaAssetId: "99999999-9999-4999-8999-999999999999",
              photoVisible: true
            },
            {
              imageMediaAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              photoVisible: false
            }
          ]
        }]
      },
      menuDocument: {
        assets: [
          { assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
          { assetId: "javascript:alert(2)" }
        ]
      },
      sport: {
        arrivalConfig: {
          showSponsor: true,
          sponsorMediaAssetId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        },
        items: [{
          awayLogoMediaAssetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          homeLogoMediaAssetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          logoMediaAssetId: "88888888-8888-4888-8888-888888888888",
          photoMediaAssetId: "12121212-1212-4212-8212-121212121212"
        }]
      },
      news: {
        articles: [
          {
            heroMediaAssetId: "33333333-3333-4333-8333-333333333333",
            qrMediaAssetId: "77777777-7777-4777-8777-777777777777"
          },
          { heroMediaAssetId: "javascript:alert(1)" }
        ],
        providerLogoMediaAssetId:
          "44444444-4444-4444-8444-444444444444"
      }
    })).toEqual([
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
      "99999999-9999-4999-8999-999999999999",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "88888888-8888-4888-8888-888888888888",
      "12121212-1212-4212-8212-121212121212",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333",
      "77777777-7777-4777-8777-777777777777"
    ]);
  });
});

describe("paged Engage capability with complete binary fallback",()=>{
 const uuid=(n:number)=>`26200000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const device={activeReleaseId:uuid(1),desiredReleaseId:uuid(1),id:uuid(2),screenId:uuid(3),screenName:"Clubscherm"};
 function setup(count=24,paged=true){
  const presentation=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:"sync-v1",sourceRevision:"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",family:"engage",orientation:"landscape",theme:"fieldflow",name:"Onze publieksvraag",title:"Wie kies jij?",club:{name:"Onze club"},style:{motion:"geen"},poll:{id:uuid(9),title:"Wie kies jij?",status:"live",visibility:"after_close",...(paged?{optionsPerPage:4}:{}),options:Array.from({length:count},(_,i)=>({id:uuid(100+i),label:`Speler ${i+1}`,votes:0}))}});
  const duration=paged?Math.ceil(count/4)*3000:3000;
  const row={id:uuid(5),source_item_id:uuid(6),live_data_enabled:false,asset_kind:paged?"video":"image",asset_title:"Volledige stemkaart",duration_seconds:duration/1000,fit_mode:"contain",muted:true,transition:"none",crop_focus_x:.5,crop_focus_y:.5,background_color:null,volume_percent:0,trim_start_seconds:0,trim_end_seconds:null,visible_from:null,visible_until:null,enabled:true,accessibility_name:null,section_source_id:null,section_name:null,section_position_key:null,storage_bucket:"tenant-media",storage_path:"tenants/"+uuid(4)+"/assets/"+uuid(7)+"/original/complete.mp4",mime_type:paged?"video/mp4":"image/png",file_size_bytes:1024,checksum_sha256:"a".repeat(64),dynamic_snapshot_id:null,youtube_video_id:null,youtube_title:null,youtube_online_only:null,sites_configuration_json:null,sites_studio_presentation_json:null,sync_studio_presentation_json:presentation,sync_studio_duration_ms:duration,engage_public_id:uuid(9),engage_title:"Onze publieksvraag",engage_question:"Wie kies jij?"};
  const release={id:uuid(1),tenant_id:uuid(4),playlist_id:uuid(8),version:1,manifest_hash:"b".repeat(64),manifest_json:{},published_at:"2026-10-19T12:00:00Z",total_bytes:1024,total_duration_seconds:duration/1000};
  const reads:string[]=[];
  fixture.admin={from(table:string){reads.push(table);const result=()=>({error:null,data:table==="playlist_release_items"?[row]:[]});const query={select(){return query;},eq(){return query;},in(){return query;},order(){return query;},limit(){return query;},single:async()=>({error:null,data:release}),maybeSingle:async()=>({error:null,data:null}),then(resolve:(value:unknown)=>unknown){return Promise.resolve(result()).then(resolve);}};return query;},storage:{from:()=>({createSignedUrl:async()=>({error:null,data:{signedUrl:"https://signed.example.invalid/complete-binary"}})})}};
  return{row,presentation,reads,load:(enableSyncStudio=false,enableSyncEngagePaging=false)=>loadPlayerReleaseEnvelope({device,releaseId:uuid(1),tenantId:uuid(4),enableSyncStudio,enableSyncEngagePaging})};
 }
 it('requires the explicit v9 capability instead of treating an old OnzeTrots header as support',async()=>{
  const value=setup(12,false);
  value.row.sync_studio_presentation_json=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'free',orientation:'landscape',theme:'onzetrots-tv',name:'Eigen nieuwe slide',title:'Eigen titel',club:{name:'Eigen club'},visual:{schemaVersion:1,mode:'light'},style:{motion:'geen'}});
  const before=await loadPlayerReleaseEnvelope({device,releaseId:uuid(1),tenantId:uuid(4),enableSyncStudio:true,enableSyncOnzeTrots:true});
  const after=await loadPlayerReleaseEnvelope({device,releaseId:uuid(1),tenantId:uuid(4),enableSyncStudio:true,enableSyncOnzeTrots:true,enableSyncOnzeTrotsV9:true});
  expect(before.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
  expect(after.manifest.items[0]!.syncStudioPresentation?.rendererVersion).toBe('sync-onzetrots-v9');
  expect(before.manifest.items[0]!.source).toEqual(after.manifest.items[0]!.source);
  assertSyncPlayerAssetManifest(before.manifest);assertSyncPlayerAssetManifest(after.manifest);
 });
 it("sends the identical complete MP4 to no-header and older Sync clients, and all twenty-four options to the new profile",async()=>{
  const test=setup(),old=await test.load(true),plain=await test.load(),fresh=await test.load(true,true);
  for(const body of[old,plain,fresh]){assertSyncPlayerAssetManifest(body.manifest);expect(body.manifest.items[0]).toMatchObject({kind:"video",durationSeconds:18,source:{bytes:1024,mimeType:"video/mp4",checksumSha256:"a".repeat(64)}});}
  const oldItem=old.manifest.items[0]!,plainItem=plain.manifest.items[0]!,newItem=fresh.manifest.items[0]!;
  for(const item of[oldItem,plainItem]){expect(item.syncStudioPresentation).toBeUndefined();expect(item.onlinePlayback).toBeUndefined();expect(item.source).toEqual(newItem.source);expect(item.contentHash).toBe(newItem.contentHash);expect(JSON.stringify(item)).not.toContain("optionsPerPage");}
  expect(newItem.syncStudioPresentation?.poll).toMatchObject({optionsPerPage:4,options:test.presentation.poll!.options});expect(newItem.onlinePlayback).toMatchObject({kind:"engage",publicId:uuid(9)});
 });
 it("keeps historical unmarked twelve-option DOM and timing unchanged for an older Sync client",async()=>{
  const test=setup(12,false),old=await test.load(true),fresh=await test.load(true,true);
  expect(old.manifest).toEqual(fresh.manifest);assertSyncPlayerAssetManifest(old.manifest);expect(old.manifest.items[0]!.durationSeconds).toBe(3);expect(old.manifest.items[0]!.syncStudioPresentation?.poll).not.toHaveProperty("optionsPerPage");
 });
 it("does not hide an invalid complete duration behind an older profile",async()=>{
  const test=setup();test.row.sync_studio_duration_ms=3000;
  await expect(test.load()).rejects.toThrow("SYNC_STUDIO_RELEASE_INVALID");await expect(test.load(true)).rejects.toThrow("SYNC_STUDIO_RELEASE_INVALID");
 });
 it("validates frozen tenant asset identities before withholding unsupported DOM",async()=>{
  const test=setup();test.row.sync_studio_presentation_json.club.logo={kind:"tenant",mediaAssetId:uuid(55),checksumSha256:"c".repeat(64)};
  await expect(test.load(true)).rejects.toThrow("SITES_STUDIO_ASSETS_UNAVAILABLE");expect(test.reads).toContain("media_assets");
 });
});
