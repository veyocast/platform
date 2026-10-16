import{describe,expect,it,vi}from"vitest";
import{inspectPublishedPlayerVideo,validatePlayerVideoProbeScope}from"./player-video-probe";
const scope={tenantId:"10000000-0000-4000-8000-000000224001",screenId:"20000000-0000-4000-8000-000000224001",assetId:"30000000-0000-4000-8000-000000224001",releaseSha:"a".repeat(40),environment:"production"};
const runtime={revision:scope.releaseSha,environment:scope.environment,lastPollAt:1000};
describe("read-only published video probe",()=>{
 it("requires exact deployed worker, environment, fresh readiness and UUID scope",()=>{
  expect(()=>validatePlayerVideoProbeScope(scope,runtime,1500)).not.toThrow();
  for(const altered of[{...scope,tenantId:"bad"},{...scope,screenId:"other' or true"},{...scope,assetId:"bad"},{...scope,releaseSha:"b".repeat(40)},{...scope,environment:"staging"}])expect(()=>validatePlayerVideoProbeScope(altered,runtime,1500)).toThrow("PROBE_SCOPE_INVALID");
  expect(()=>validatePlayerVideoProbeScope(scope,runtime,100000)).toThrow("PROBE_SCOPE_INVALID");expect(()=>validatePlayerVideoProbeScope(scope,{...runtime,lastPollAt:Infinity},1500)).toThrow("PROBE_SCOPE_INVALID");
 });
 it("rejects another tenant, forged asset and excessive size before downloading",async()=>{
  const download=vi.fn();const asset={tenant_id:scope.tenantId,media_asset_id:scope.assetId,file_size_bytes:10,storage_bucket:"tenant-media",storage_path:`tenants/${scope.tenantId}/assets/${scope.assetId}/variant.mp4`,checksum_sha256:"c".repeat(64),mime_type:"video/mp4",width:1080,height:1920};
  for(const changed of[{...asset,tenant_id:scope.screenId},{...asset,media_asset_id:scope.screenId},{...asset,file_size_bytes:500*1024*1024},{...asset,mime_type:"text/plain"}])await expect(inspectPublishedPlayerVideo({scope,releaseId:"release",asset:changed,download})).rejects.toThrow("VIDEO_PROBE_ASSET_INVALID");
  for(const changed of[{...asset,storage_bucket:"private-other"},{...asset,storage_path:"tenants/other/assets/other/video.mp4"}])await expect(inspectPublishedPlayerVideo({scope,releaseId:"release",asset:changed,download})).rejects.toThrow("ASSET_SCOPE_INVALID");
  expect(download).not.toHaveBeenCalled();
 });
});
