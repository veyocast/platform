import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { adminRpc, anonRpc, loadEnvelope } = vi.hoisted(() => ({ adminRpc: vi.fn(), anonRpc: vi.fn(), loadEnvelope: vi.fn() }));
vi.mock("../../../_lib/player-supabase", () => ({
  isLivePlayerConfigured: () => true,
  createPlayerAnonClient: () => ({ rpc: anonRpc }),
  createPlayerAdminClient: () => ({ rpc: adminRpc, from: () => { throw new Error("branding unavailable in fixture"); } })
}));
vi.mock("../../../_lib/player-release-envelope", () => ({ loadPlayerReleaseEnvelope: loadEnvelope }));
import { getPlayerManifestForToken } from "../../../_lib/player-manifest";
import { GET } from "./route";

const target = { tenant_id: "tenant-A", device_id: "device-A", screen_id: "screen-A", screen_name: "Test",
  device_status: "paired", screen_status: "active", active_release_id: "old", desired_release_id: "current",
  target_revision: "12", publication_id: "playlist-A", config_revision: "100", assignment_source: "default",
  target_changed_at: "2026-09-19T12:00:00Z", data_key: "binding-A:2", sponsor_key: "" };
const request = (etag?: string,renderer?:string,dynamic?:string) => new Request("https://player.veyocast.nl/api/player/manifest", {
  headers: { Authorization: "Bearer device-secret-fixture", ...(etag ? { "If-None-Match": etag } : {}),...(renderer?{"X-VeyoCast-Sync-Renderer":renderer}:{}),...(dynamic?{'X-VeyoCast-Sync-Dynamic':dynamic}:{}) }
});

describe("authorized current-target API", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-19T12:01:00Z"));
    adminRpc.mockReset().mockResolvedValue({ data: target, error: null });
    anonRpc.mockReset().mockResolvedValue({ data: [], error: null });
    loadEnvelope.mockReset().mockImplementation(async () => {
      const fixture = getPlayerManifestForToken("demo-online");
      if (!fixture.ok) throw new Error("fixture unavailable");
      return structuredClone(fixture.body);
    });
  });
  afterEach(() => vi.useRealTimers());

  it("authenticates every 304 and avoids signing/loading unchanged manifests", async () => {
    const first = await GET(request());
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag")!;
    loadEnvelope.mockClear(); adminRpc.mockClear();
    const next = await GET(request(etag));
    expect(next.status).toBe(304);
    expect(adminRpc).toHaveBeenCalledOnce();
    expect(loadEnvelope).not.toHaveBeenCalled();
    expect(next.headers.get("vary")).toBe("Authorization, X-VeyoCast-Sync-Renderer, X-VeyoCast-Sync-Dynamic, X-VeyoCast-Sync-Backgrounds, X-VeyoCast-Sync-Engage-Paging");
    expect(await next.text()).toBe("");
  });
  it("negotiates Source before conditional caching without sharing the binary profile ETag",async()=>{
    const binary=await GET(request());expect(loadEnvelope).toHaveBeenLastCalledWith(expect.objectContaining({enableSyncStudio:false}));
    const source=await GET(request(binary.headers.get("etag")!,"sync-v1"));expect(source.status).toBe(200);expect(loadEnvelope).toHaveBeenLastCalledWith(expect.objectContaining({enableSyncStudio:true}));expect(source.headers.get("etag")).not.toBe(binary.headers.get("etag"));
    loadEnvelope.mockClear();const unchanged=await GET(request(source.headers.get("etag")!,"sync-v1"));expect(unchanged.status).toBe(304);expect(loadEnvelope).not.toHaveBeenCalled();
    const unsupported=await GET(request(binary.headers.get("etag")!,"unknown-renderer"));expect(unsupported.status).toBe(304);
  });
  it("an advertised Source renderer cannot bypass credential revocation",async()=>{
    const first=await GET(request(undefined,"sync-v1"));adminRpc.mockResolvedValue({data:null,error:null});anonRpc.mockResolvedValue({data:"DEVICE_REVOKED",error:null});expect((await GET(request(first.headers.get("etag")!,"sync-v1"))).status).toBe(403);
  });
  it('keeps Source dynamic DOM, new binary and old binary profiles independently authorized and cached',async()=>{
    const old=await GET(request());const dom=await GET(request(old.headers.get('etag')!,undefined,'sync-dynamic-v1'));
    expect(dom.status).toBe(200);expect(loadEnvelope).toHaveBeenLastCalledWith(expect.objectContaining({enableSyncStudio:false,syncDynamicMode:'dom'}));
    const binary=await GET(request(dom.headers.get('etag')!,undefined,'sync-dynamic-binary-v1'));expect(binary.status).toBe(200);expect(loadEnvelope).toHaveBeenLastCalledWith(expect.objectContaining({syncDynamicMode:'binary'}));expect(binary.headers.get('etag')).not.toBe(old.headers.get('etag'));expect(binary.headers.get('etag')).not.toBe(dom.headers.get('etag'));
    loadEnvelope.mockClear();expect((await GET(request(binary.headers.get('etag')!,undefined,'sync-dynamic-binary-v1'))).status).toBe(304);expect(loadEnvelope).not.toHaveBeenCalled();
    adminRpc.mockResolvedValue({data:null,error:null});anonRpc.mockResolvedValue({data:'DEVICE_REVOKED',error:null});expect((await GET(request(dom.headers.get('etag')!,undefined,'sync-dynamic-v1'))).status).toBe(403);
  });
  it("rejects a revoked credential despite a previously valid target ETag", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: null, error: null });
    anonRpc.mockResolvedValue({ data: "DEVICE_REVOKED", error: null });
    expect((await GET(request(first.headers.get("etag")!))).status).toBe(403);
  });
  it("does not share an ETag across authorized tenant/device targets", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: { ...target, tenant_id: "tenant-B", screen_id: "screen-B", device_id: "device-B" }, error: null });
    const next = await GET(request(first.headers.get("etag")!));
    expect(next.status).toBe(200);
    expect(next.headers.get("etag")).not.toBe(first.headers.get("etag"));
  });
  it("rejects a target changed while a manifest was being prepared", async () => {
    adminRpc.mockResolvedValueOnce({ data: target, error: null })
      .mockResolvedValueOnce({ data: { ...target, target_revision: "13", desired_release_id: "newer" }, error: null });
    const result = await GET(request());
    expect(result.status).toBe(409);
    expect(await result.json()).toHaveProperty("error.code", "TARGET_CHANGED");
  });
  it("refreshes data and signed access independently of the configuration revision", async () => {
    const first = await GET(request());
    adminRpc.mockResolvedValue({ data: { ...target, data_key: "binding-A:3" }, error: null });
    const data = await GET(request(first.headers.get("etag")!));
    expect(data.status).toBe(200);
    expect(await data.json()).toHaveProperty("target.configRevision", "100");
    vi.setSystemTime(new Date("2026-09-19T12:31:00Z"));
    const access = await GET(request(data.headers.get("etag")!));
    expect(access.status).toBe(200);
    expect(await access.json()).toHaveProperty("target.revision", "12");
  });
});


it("varies authorized ETags by the exact backgrounds capability and forwards it to every composed release", async () => {
  const uuid = (n: number) => `23800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const candidate = { id: uuid(10), revision: 1, configuration: { schemaVersion: 1, layout: "three", orientation: "landscape", mainWidthPercent: 70, bottomHeightPercent: 20, zones: ["main", "side", "bottom"].map((id, index) => ({ id, playlistId: uuid(20 + index) })) }, bindings: ["main", "side", "bottom"].map((zoneId, index) => ({ zoneId, playlistId: uuid(20 + index), releaseId: uuid(30 + index), publicationId: uuid(40 + index), configRevision: 1 })) };
  adminRpc.mockReset().mockResolvedValue({ data: { ...target, desired_release_id: uuid(30), composition: candidate }, error: null });
  anonRpc.mockReset().mockResolvedValue({ data: [], error: null });
  loadEnvelope.mockReset().mockImplementation(async ({ releaseId, device }) => {
    const result = getPlayerManifestForToken("demo-online"); if (!result.ok) throw Error("fixture unavailable");
    const body = structuredClone(result.body), index = [30, 31, 32].findIndex(n => uuid(n) === releaseId);
    body.device = device; body.manifest.releaseId = releaseId; body.manifest.playlistId = uuid(20 + index); body.manifest.tenantId = target.tenant_id; return body;
  });
  const capabilityRequest = (value: string | null, etag?: string) => {
    const base = request(etag, "sync-v1", "sync-dynamic-v1");
    if (value !== null) base.headers.set("X-VeyoCast-Sync-Backgrounds", value); return base;
  };
  const old = await GET(capabilityRequest(null)); expect(old.status).toBe(200);
  expect(loadEnvelope).toHaveBeenCalledTimes(3);
  for (const [options] of loadEnvelope.mock.calls) expect(options).toMatchObject({ enableSyncStudio: true, syncDynamicMode: "dom", enableSyncBackgrounds: false });
  loadEnvelope.mockClear();
  const fresh = await GET(capabilityRequest("sync-backgrounds-v1", old.headers.get("etag")!)); expect(fresh.status).toBe(200);
  expect(fresh.headers.get("etag")).not.toBe(old.headers.get("etag")); expect(loadEnvelope).toHaveBeenCalledTimes(3);
  for (const [options] of loadEnvelope.mock.calls) expect(options).toMatchObject({ enableSyncStudio: true, syncDynamicMode: "dom", enableSyncBackgrounds: true });
  const composed = await fresh.json(); expect(Object.keys(composed.composition.zones).sort()).toEqual(["bottom", "side"]);
  loadEnvelope.mockClear(); adminRpc.mockClear();
  const same = await GET(capabilityRequest("sync-backgrounds-v1", fresh.headers.get("etag")!));
  expect(same.status).toBe(304); expect(adminRpc).toHaveBeenCalledOnce(); expect(loadEnvelope).not.toHaveBeenCalled(); expect(same.headers.get("vary")).toContain("X-VeyoCast-Sync-Backgrounds");
  expect((await GET(capabilityRequest("unknown-backgrounds", old.headers.get("etag")!))).status).toBe(304);
  adminRpc.mockResolvedValue({ data: null, error: null }); anonRpc.mockResolvedValue({ data: "DEVICE_REVOKED", error: null });
  expect((await GET(capabilityRequest("sync-backgrounds-v1", fresh.headers.get("etag")!))).status).toBe(403);
});

it("negotiates paged Engage independently for every composed release and every authorized conditional response",async()=>{
 const uuid=(n:number)=>`26200000-0000-4000-8000-${String(n).padStart(12,"0")}`;
 const composition={id:uuid(10),revision:1,configuration:{schemaVersion:1,layout:"three",orientation:"landscape",mainWidthPercent:70,bottomHeightPercent:20,zones:["main","side","bottom"].map((id,index)=>({id,playlistId:uuid(20+index)}))},bindings:["main","side","bottom"].map((zoneId,index)=>({zoneId,playlistId:uuid(20+index),releaseId:uuid(30+index),publicationId:uuid(40+index),configRevision:1}))};
 adminRpc.mockReset().mockResolvedValue({data:{...target,desired_release_id:uuid(30),composition},error:null});anonRpc.mockReset().mockResolvedValue({data:[],error:null});
 loadEnvelope.mockReset().mockImplementation(async({releaseId,device})=>{
  const result=getPlayerManifestForToken("demo-online");if(!result.ok)throw Error("fixture unavailable");
  const body=structuredClone(result.body),index=[30,31,32].findIndex(n=>uuid(n)===releaseId);body.device=device;body.manifest.releaseId=releaseId;body.manifest.playlistId=uuid(20+index);body.manifest.tenantId=target.tenant_id;return body;
 });
 const capabilityRequest=(value:string|null,etag?:string,renderer="sync-v1")=>{
  const base=request(etag,renderer);if(value!==null)base.headers.set("X-VeyoCast-Sync-Engage-Paging",value);return base;
 };
 const old=await GET(capabilityRequest(null));expect(old.status).toBe(200);expect(loadEnvelope).toHaveBeenCalledTimes(3);
 for(const[options]of loadEnvelope.mock.calls)expect(options.enableSyncEngagePaging).toBe(false);
 loadEnvelope.mockClear();const fresh=await GET(capabilityRequest("sync-engage-pages-v1",old.headers.get("etag")!));expect(fresh.status).toBe(200);expect(fresh.headers.get("etag")).not.toBe(old.headers.get("etag"));expect(loadEnvelope).toHaveBeenCalledTimes(3);
 for(const[options]of loadEnvelope.mock.calls)expect(options).toMatchObject({enableSyncStudio:true,enableSyncEngagePaging:true});
 loadEnvelope.mockClear();adminRpc.mockClear();const same=await GET(capabilityRequest("sync-engage-pages-v1",fresh.headers.get("etag")!));
 expect(same.status).toBe(304);expect(adminRpc).toHaveBeenCalledOnce();expect(loadEnvelope).not.toHaveBeenCalled();expect(same.headers.get("vary")).toContain("X-VeyoCast-Sync-Engage-Paging");
 expect((await GET(capabilityRequest("unknown-pages",old.headers.get("etag")!))).status).toBe(304);
 const noRenderer=await GET(capabilityRequest("sync-engage-pages-v1",undefined,"unknown"));expect(noRenderer.status).toBe(200);
 for(const[options]of loadEnvelope.mock.calls)expect(options.enableSyncEngagePaging).toBe(false);
 adminRpc.mockResolvedValue({data:null,error:null});anonRpc.mockResolvedValue({data:"DEVICE_REVOKED",error:null});expect((await GET(capabilityRequest("sync-engage-pages-v1",fresh.headers.get("etag")!))).status).toBe(403);
});
