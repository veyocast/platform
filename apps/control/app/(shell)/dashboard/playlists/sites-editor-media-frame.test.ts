import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import type { PlaylistStudioData } from "./data";

const f=vi.hoisted(()=>({rows:{} as Record<string,Array<Record<string,unknown>>>,queries:[] as Array<{table:string;filters:Array<[string,unknown]>}>,sign:vi.fn()}));
vi.mock("../../../../lib/supabase/server",()=>({createControlSupabaseClient:async()=>({storage:{from:()=>({createSignedUrl:f.sign})},from:(table:string)=>{
  const query={table,filters:[] as Array<[string,unknown]>};f.queries.push(query);
  const builder={select:()=>builder,eq:(key:string,value:unknown)=>{query.filters.push([key,value]);return builder},in:(key:string,value:unknown)=>{query.filters.push([key,value]);return builder},order:()=>builder,limit:()=>builder,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:f.rows[table]??[],error:null}).then(resolve)};return builder;
}})}));
import { loadSitesPlaylistEditor } from "./sites-editor-data";
const id=(n:number)=>`19170000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tenant=id(10),frame=id(20),asset=id(30),variant=id(40),pinned=id(1),latest=id(2),item=id(100);
const path=`tenants/${tenant}/assets/${asset}/frozen.webp`;
const data=()=>({playlist:{id:id(500),name:"Eigen playlist",description:"",status:"draft",revision:7,updatedAt:""},items:[{id:item,mediaAssetId:asset,mediaFrameId:frame,mediaFrameVersionId:pinned,mediaFrameOverrides:{},durationSeconds:601,fitMode:"contain",cropFocusX:0.5,cropFocusY:0.5,backgroundColor:null,asset:{id:asset,title:"Huidige assettitel",kind:"video",variant:{checksumSha256:"a".repeat(64),previewUrl:"preferred-variant-is-not-pinned"}}}],screens:[],youtubeSources:[],engageCampaigns:[]} as unknown as PlaylistStudioData);
beforeEach(()=>{
  f.queries=[];f.sign.mockReset().mockImplementation(async(p:string)=>({data:{signedUrl:`https://private.example.test/${p}`},error:null}));
  f.rows={media_frames:[{id:frame,source_asset_id:asset,status:"active",current_version_id:latest}],media_frame_versions:[{id:pinned,frame_id:frame,version_number:1,settings_json:{...mediaFrameDefaultSettings({kind:"video",title:"Eerste vaste titel",durationSeconds:601})}},{id:latest,frame_id:frame,version_number:2,settings_json:{...mediaFrameDefaultSettings({kind:"video",title:"Nieuwe vaste titel",durationSeconds:901})}}],media_frame_version_assets:[pinned,latest].map(version_id=>({version_id,role:"media",media_asset_id:asset,variant_id:variant,checksum_sha256:"a".repeat(64),byte_size:1234,storage_bucket:"tenant-media",storage_path:path,mime_type:"video/mp4"})),media_assets:[{id:asset,kind:"video",status:"ready",deleted_at:null}],media_variants:[{id:variant,asset_id:asset,checksum_sha256:"a".repeat(64),file_size_bytes:1234,storage_bucket:"tenant-media",storage_path:path,mime_type:"video/mp4"}]};
});
const load=()=>loadSitesPlaylistEditor(tenant,data(),{media:false,studio:false,dynamic:false});
describe("playlist frame readmodel preserves pinned immutable source",()=>{
  it("keeps the pinned version and duration separate from an explicitly available new version",async()=>{
    const result=await load();const bound=result.playlist.slides[0]!;
    expect(bound.seconds).toBe(601);expect(bound.mediaFrame).toMatchObject({frameId:frame,pinnedVersionId:pinned,pinnedVersionNumber:1,selected:{id:pinned,settings:{name:"Eerste vaste titel",durationSeconds:601}},current:{id:latest,settings:{name:"Nieuwe vaste titel",durationSeconds:901}}});
    expect(bound.image).toContain(path);expect(bound.image).not.toBe("preferred-variant-is-not-pinned");expect(f.sign).toHaveBeenCalledWith(path,900);
    for(const query of f.queries.filter(q=>q.table.startsWith("media_frame")||q.table==="media_variants"||q.table==="media_assets"))expect(query.filters).toContainEqual(["tenant_id",tenant]);
  });
  it("does not expose an archived frame as a refresh choice but retains its valid pinned version",async()=>{
    f.rows.media_frames![0]!.status="archived";
    expect((await load()).playlist.slides[0]!.mediaFrame).toMatchObject({pinnedVersionId:pinned,current:null});
  });
  it("fails closed for a pinned version belonging to another frame",async()=>{
    f.rows.media_frame_versions![0]!.frame_id=id(21);await expect(load()).rejects.toThrow("oorspronkelijke media-ontwerpversie");
  });
  it("does not replace an invalid pinned fingerprint with today's preferred asset",async()=>{
    f.rows.media_variants![0]!.checksum_sha256="b".repeat(64);await expect(load()).rejects.toThrow("oorspronkelijke media-ontwerpversie");expect(f.sign).not.toHaveBeenCalled();
  });
  it("refuses a foreign private path even when the returned reference and variant agree",async()=>{
    const foreign=`tenants/${id(11)}/assets/${asset}/frozen.mp4`;f.rows.media_variants![0]!.storage_path=foreign;f.rows.media_frame_version_assets!.forEach(ref=>{ref.storage_path=foreign});
    await expect(load()).rejects.toThrow("oorspronkelijke media-ontwerpversie");expect(f.sign).not.toHaveBeenCalled();
  });
  it("retains old playback when only the current immutable version is unavailable",async()=>{
    f.rows.media_frame_version_assets=f.rows.media_frame_version_assets!.filter(ref=>ref.version_id!==latest);
    expect((await load()).playlist.slides[0]!.mediaFrame).toMatchObject({pinnedVersionId:pinned,current:null});
  });
});
