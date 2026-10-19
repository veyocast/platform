import { describe, expect, it, vi } from "vitest";
import { supportsSyncBackgrounds, supportsSyncSlideDom } from "./sync-player-capabilities";
import {
  syncSlidePresentationSchema,
  syncSystemAssets,
  syncBackgroundAssets,
} from "@veyocast/contracts";
import {
  getPlayerManifestForToken,
  demoOnlineDeviceToken,
  type PlayerManifestEnvelope,
} from "./player-manifest";
import {
  getCacheableAssets,
  refreshHydratedReleaseEnvelope,
} from "./player-cache";
import {
  syncPreparedCss,
  syncPreparedPresentation,
  isSyncPreparedUrl,
  syncPlaybackFrame,
  prepareSyncBackgroundFonts,
} from "./sync-player-presentation";
import sitesAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
const origin = "https://player.veyocast.nl";
function fixture(): PlayerManifestEnvelope {
  const actual = getPlayerManifestForToken(demoOnlineDeviceToken);
  if (!actual.ok) throw Error("Missing existing fixture");
  const result = structuredClone(actual.body);
  result.manifest.items = [result.manifest.items[0]!];
  const item = result.manifest.items[0]!;
  item.syncStudioPresentation = syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: "sync-v1",
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
    family: "free",
    orientation: "landscape",
    theme: "fieldflow",
    name: "Eigen Source",
    title: "Eigen titel",
    club: { name: "Club A" },
    style: {},
  });
  item.syncStudioDurationMs = 3000;
  item.syncStudioAssets = {};
  result.manifest.syncSystemAssets = syncSystemAssets.map((asset) => ({
    path: asset.path,
    checksumSha256: asset.sha256,
    bytes: asset.bytes,
    mimeType: asset.mimeType,
  }));
  return result;
}
const prepared = (hash: string) => `/__veyocast-player-cache/${hash}`;

it("keeps core DOM negotiation while requiring an actual image decoder for the additive gallery capability", () => {
  try {
    vi.stubGlobal("window", {}); vi.stubGlobal("CSS", { supports: () => true });
    vi.stubGlobal("ResizeObserver", class {}); vi.stubGlobal("document", { fonts: { load() {}, add() {}, delete() {} } });
    vi.stubGlobal("FontFace", class { load() {} });
    vi.stubGlobal("Image", class {});
    expect(supportsSyncSlideDom()).toBe(true); expect(supportsSyncBackgrounds()).toBe(false);
    vi.stubGlobal("Image", class { decode() { return Promise.resolve(); } });
    expect(supportsSyncBackgrounds()).toBe(true);
    vi.stubGlobal("FontFace", class {});
    expect(supportsSyncSlideDom()).toBe(true); expect(supportsSyncBackgrounds()).toBe(false);
    vi.stubGlobal("FontFace", class { load() {} });
    vi.stubGlobal("document", { fonts: { load() {}, add() {} } });
    expect(supportsSyncSlideDom()).toBe(true); expect(supportsSyncBackgrounds()).toBe(false);
    vi.stubGlobal("CSS", { supports: () => false }); expect(supportsSyncBackgrounds()).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});

describe("gallery-owned cached font readiness", () => {
  const urls = Object.fromEntries(syncSystemAssets.map(asset => [asset.path, prepared(asset.sha256)]));
  function setup(load: (face: MockFace) => Promise<MockFace> = async face => { face.status = "loaded"; return face; }) {
    const globalFace = { family: "Inter", status: "error" };
    const registered = new Set<unknown>([globalFace]);
    const globalLoad = vi.fn(() => Promise.reject(Error("global network font unavailable")));
    const created: MockFace[] = [];
    class MockFace {
      status = "unloaded";
      constructor(readonly family: string, readonly source: string, readonly descriptors: FontFaceDescriptors) { created.push(this); }
      load() { return load(this); }
    }
    vi.stubGlobal("FontFace", MockFace);
    vi.stubGlobal("document", { fonts: { load: globalLoad, add: (face: unknown) => registered.add(face), delete: (face: unknown) => registered.delete(face) } });
    return { globalFace, registered, created, globalLoad };
  }
  type MockFace = { family: string; source: string; descriptors: FontFaceDescriptors; status: string };

  it("loads official cached faces despite an unrelated global network font failure, and removes only its own faces", async () => {
    try {
      const state = setup(), preparation = prepareSyncBackgroundFonts(urls, origin);
      await preparation.ready;
      expect(state.globalLoad).not.toHaveBeenCalled(); expect(state.registered.size).toBe(5);
      expect(state.created.map(face => [face.family, face.descriptors.weight])).toEqual([["Inter", "100 900"], ["Manrope", "200 800"], ["OnzeTrots", "normal"], ["OnzeTrots Brush", "normal"]]);
      expect(state.created.every(face => face.source.includes("/__veyocast-player-cache/") && face.status === "loaded")).toBe(true);
      preparation.dispose(); expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("rejects an unprepared network font URL before it can enter the font set", async () => {
    try {
      const state = setup(), preparation = prepareSyncBackgroundFonts({ ...urls, "/assets/inter.woff2": "https://external.invalid/font.woff2" }, origin);
      await expect(preparation.ready).rejects.toThrow("SYNC_PREPARED_ASSET_UNAVAILABLE");
      expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("cleans up partial success and never registers a late face after another face fails", async () => {
    const finishes: (() => void)[] = [];
    try {
      const state = setup(face => face.family === "Inter" ? Promise.resolve(Object.assign(face, { status: "loaded" })) : face.family === "Manrope" ? Promise.reject(Error("decode failed")) : new Promise(resolve => finishes.push(() => { face.status = "loaded"; resolve(face); })));
      const preparation = prepareSyncBackgroundFonts(urls, origin);
      await expect(preparation.ready).rejects.toThrow("decode failed");
      for (const finish of finishes) finish(); await Promise.resolve();
      expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("does not register a face whose asynchronous load finishes after cleanup", async () => {
    const finishes: (() => void)[] = [];
    try {
      const state = setup(face => new Promise(resolve => finishes.push(() => { face.status = "loaded"; resolve(face); })));
      const preparation = prepareSyncBackgroundFonts(urls, origin); await Promise.resolve();
      preparation.dispose(); for (const finish of finishes) finish(); await preparation.ready;
      expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("independent Sync Player cache protocol", () => {
  it('matches cover/contain crop focus and background with the same binary placement',()=>{
    const item=fixture().manifest.items[0]!;item.syncStudioPresentation!.orientation='portrait';item.cropFocus={x:0,y:1};item.backgroundColor='#123456';item.fitMode='cover';
    expect(syncPlaybackFrame(item,{width:960,height:540})).toEqual({width:960,height:960*16/9,left:0,top:540-960*16/9,backgroundColor:'#123456'});
    item.fitMode='contain';expect(syncPlaybackFrame(item,{width:960,height:540})).toEqual({width:540*9/16,height:540,left:0,top:0,backgroundColor:'#123456'});
  });
  it('keeps the verified binary when a historical trim omits any part of the Source loop',()=>{
    const item=fixture().manifest.items[0]!;item.syncSystemAssetUrls=Object.fromEntries(syncSystemAssets.map(asset=>[asset.path,prepared(asset.sha256)]));
    item.trim={startSeconds:1};expect(syncPreparedPresentation(item,origin)).toBe(false);
    item.trim={startSeconds:0,endSeconds:2};expect(syncPreparedPresentation(item,origin)).toBe(false);
    item.trim={startSeconds:0,endSeconds:3};expect(syncPreparedPresentation(item,origin)).toBe(true);
  });
  it("requires every declared Source asset and retains the full binary media fallback", () => {
    const value = fixture(),
      assets = getCacheableAssets(value.manifest);
    expect(
      assets.some(
        (asset) =>
          asset.kind === "media" &&
          asset.checksumSha256 ===
            value.manifest.items[0]!.source.checksumSha256,
      ),
    ).toBe(true);
    expect(assets.filter((asset) => asset.itemId === "sync-v1")).toHaveLength(
      11,
    );
    expect(value.manifest.systemAssets).toBeUndefined();
  });
  it("does not broaden or replace the strict historic Sites asset manifest", () => {
    const value = fixture();
    value.manifest.systemAssets = sitesAssets.files.map((asset) => ({
      path: asset.path,
      checksumSha256: asset.sha256,
      bytes: asset.bytes,
      mimeType: asset.mimeType,
    }));
    expect(() => getCacheableAssets(value.manifest)).not.toThrow();
    value.manifest.systemAssets.push(value.manifest.syncSystemAssets![0]!);
    expect(() => getCacheableAssets(value.manifest)).toThrow(
      "SITES_ASSET_MANIFEST_INVALID",
    );
  });
  it("refuses incomplete, duplicated, modified or missing Source declarations", () => {
    for (const operation of ["missing", "removed", "duplicate", "changed"]) {
      const value = fixture();
      if (operation === "missing") delete value.manifest.syncSystemAssets;
      else if (operation === "removed") value.manifest.syncSystemAssets!.pop();
      else if (operation === "duplicate")
        value.manifest.syncSystemAssets![1] =
          value.manifest.syncSystemAssets![0]!;
      else value.manifest.syncSystemAssets![0]!.checksumSha256 = "0".repeat(64);
      expect(() => getCacheableAssets(value.manifest)).toThrow(
        "SYNC_ASSET_MANIFEST_INVALID",
      );
    }
  });
  it("refuses truncated page timing and mixed renderer identities", () => {
    const value = fixture(),
      item = value.manifest.items[0]!;
    item.syncStudioPresentation = {
      ...item.syncStudioPresentation!,
      rows: Array.from({ length: 9 }, () => ["A", "B", "14:00", "1"]),
      rowsPerPage: 4,
    };
    item.syncStudioDurationMs = 6000;
    expect(() => getCacheableAssets(value.manifest)).toThrow(
      "SYNC_STUDIO_PRESENTATION_INVALID",
    );
    item.syncStudioDurationMs = 9000;
    item.durationSeconds = 6;
    expect(() => getCacheableAssets(value.manifest)).toThrow(
      "SYNC_STUDIO_PRESENTATION_INVALID",
    );
  });
  it("binds tenant images to exactly their declared source checksums", () => {
    const value = fixture(),
      item = value.manifest.items[0]!,
      id = "30000000-0000-4000-8000-000000000226";
    item.syncStudioPresentation!.club.logo = {
      kind: "tenant",
      mediaAssetId: id,
      checksumSha256: "c".repeat(64),
    };
    expect(() => getCacheableAssets(value.manifest)).toThrow(
      "SYNC_STUDIO_ASSETS_UNAVAILABLE",
    );
    item.syncStudioAssets = {
      [id]: {
        bytes: 100,
        checksumSha256: "c".repeat(64),
        mimeType: "image/png",
        url: "https://media.example/own.png",
      },
    };
    expect(
      getCacheableAssets(value.manifest).some(
        (asset) => asset.checksumSha256 === "c".repeat(64),
      ),
    ).toBe(true);
    item.syncStudioAssets[id]!.checksumSha256 = "d".repeat(64);
    expect(() => getCacheableAssets(value.manifest)).toThrow(
      "SYNC_STUDIO_ASSETS_UNAVAILABLE",
    );
  });
  it("a signed URL refresh cannot activate Source on a legacy binary cache of the same release", () => {
    const fresh = fixture(),
      cached = structuredClone(fresh);
    delete cached.manifest.syncSystemAssets;
    const original = cached.manifest.items[0]!;
    delete original.syncStudioPresentation;
    delete original.syncStudioDurationMs;
    delete original.syncStudioAssets;
    original.source.url = prepared(original.source.checksumSha256);
    const refreshed = refreshHydratedReleaseEnvelope({
      cachedEnvelope: cached,
      freshEnvelope: fresh,
      online: false,
    });
    expect(refreshed.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
    expect(refreshed.manifest.syncSystemAssets).toBeUndefined();
    expect(refreshed.manifest.items[0]!.source.url).toBe(original.source.url);
    expect(getCacheableAssets(refreshed.manifest)).toHaveLength(1);
    expect(fresh.manifest.items[0]!.syncStudioPresentation).toBeDefined();
  });
  it("a new release retains its independent Source preparation requirements", () => {
    const fresh = fixture(),
      cached = structuredClone(fresh);
    cached.manifest.releaseId = "00000000-0000-4000-8000-000000000001";
    delete cached.manifest.items[0]!.syncStudioPresentation;
    const refreshed = refreshHydratedReleaseEnvelope({
      cachedEnvelope: cached,
      freshEnvelope: fresh,
    });
    expect(refreshed.manifest.items[0]!.syncStudioPresentation).toBeDefined();
    expect(refreshed.manifest.syncSystemAssets).toHaveLength(11);
  });
  it("rejects a mutable presentation change inside the same immutable active release", () => {
    const cached = fixture(),
      fresh = structuredClone(cached);
    fresh.manifest.items[0]!.syncStudioPresentation!.title =
      "Unexpected mutation";
    expect(() =>
      refreshHydratedReleaseEnvelope({
        cachedEnvelope: cached,
        freshEnvelope: fresh,
      }),
    ).toThrow("SYNC_IMMUTABLE_PRESENTATION_CHANGED");
  });
  it("only uses locally prepared Source images and fonts; HTTP/data cannot replace them", () => {
    const value = fixture(),
      item = value.manifest.items[0]!;
    item.syncSystemAssetUrls = Object.fromEntries(
      syncSystemAssets.map((asset) => [asset.path, prepared(asset.sha256)]),
    );
    expect(syncPreparedPresentation(item, origin)).toBe(true);
    const css = syncPreparedCss(item.syncSystemAssetUrls, origin);
    expect(css).not.toMatch(/url\(['"]?\/assets\//);
    expect(css).toContain("/__veyocast-player-cache/");
    item.syncSystemAssetUrls[syncSystemAssets[0]!.path] =
      "data:image/png;base64,AAAA";
    expect(syncPreparedPresentation(item, origin)).toBe(false);
    expect(isSyncPreparedUrl("https://media.example/image.png", origin)).toBe(
      false,
    );
    expect(
      isSyncPreparedUrl(
        `blob:${origin}/0e91ec44-d0e3-43ee-920b-87024ac8903c`,
        origin,
      ),
    ).toBe(true);
    expect(isSyncPreparedUrl("blob:https://other.example/id", origin)).toBe(
      false,
    );
  });
});

function connectedFixture(){
 const value=fixture(),item=value.manifest.items[0]!,presentation=item.syncStudioPresentation!;
 delete item.syncStudioPresentation;delete item.syncStudioDurationMs;delete item.syncStudioAssets;
 item.kind='image';item.source.mimeType='image/png';item.syncDynamic={schemaVersion:1,configurationSnapshotId:'10000000-0000-4000-8000-000000000229',snapshotId:'20000000-0000-4000-8000-000000000229',templateVersionId:'30000000-0000-4000-8000-000000000229',configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),fallbackChecksumSha256:item.source.checksumSha256,durationMs:3000,presentation,assets:{}};
 return value;
}
it('prepares the connected Source asset union while keeping its Studio fields absent',()=>{
 const value=connectedFixture(),item=value.manifest.items[0]!;expect(getCacheableAssets(value.manifest)).toHaveLength(12);expect(item.syncStudioPresentation).toBeUndefined();
 expect(syncPreparedPresentation(item,origin)).toBe(false);item.syncSystemAssetUrls=Object.fromEntries(syncSystemAssets.map(asset=>[asset.path,prepared(asset.sha256)]));expect(syncPreparedPresentation(item,origin)).toBe(true);
 item.syncDynamic!.fallbackChecksumSha256='f'.repeat(64);expect(syncPreparedPresentation(item,origin)).toBe(false);expect(()=>getCacheableAssets(value.manifest)).toThrow('SYNC_DYNAMIC_PRESENTATION_INVALID');
});
it('requires private connected images to be verified before DOM and preserves prepared access on URL refresh',()=>{
 const value=connectedFixture(),item=value.manifest.items[0]!,id='40000000-0000-4000-8000-000000000229';item.syncDynamic!.presentation.club.logo={kind:'tenant',mediaAssetId:id,checksumSha256:'d'.repeat(64)};item.syncDynamic!.assets={[id]:{bytes:100,checksumSha256:'d'.repeat(64),mimeType:'image/png',url:'https://media.example/own.png'}};item.syncSystemAssetUrls=Object.fromEntries(syncSystemAssets.map(asset=>[asset.path,prepared(asset.sha256)]));
 expect(getCacheableAssets(value.manifest)).toHaveLength(13);expect(syncPreparedPresentation(item,origin)).toBe(false);
 const cached=structuredClone(value);cached.manifest.items[0]!.syncDynamic!.assets[id]!.url=prepared('d'.repeat(64));expect(syncPreparedPresentation(cached.manifest.items[0]!,origin)).toBe(true);
 const refreshed=refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:value,online:false});expect(refreshed.manifest.items[0]!.syncDynamic!.assets[id]!.url).toBe(prepared('d'.repeat(64)));expect(refreshed.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
});
it('keeps a binary-only Source cache binary during an unprepared signed-access refresh',()=>{
 const value=connectedFixture(),cached=structuredClone(value);delete cached.manifest.items[0]!.syncDynamic;delete cached.manifest.syncSystemAssets;const refreshed=refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:value});expect(refreshed.manifest.items[0]!.syncDynamic).toBeUndefined();expect(refreshed.manifest.syncSystemAssets).toBeUndefined();expect(getCacheableAssets(refreshed.manifest)).toHaveLength(1);
});
it('rejects a changed Source configuration inside the same publication while retaining independent data identity',()=>{
 const cached=connectedFixture(),fresh=structuredClone(cached);fresh.manifest.items[0]!.syncDynamic!.configurationHash='e'.repeat(64);expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:fresh})).toThrow('SYNC_DYNAMIC_CONFIGURATION_CHANGED');
 fresh.manifest.items[0]!.syncDynamic!.configurationHash=cached.manifest.items[0]!.syncDynamic!.configurationHash;fresh.manifest.items[0]!.syncDynamic!.contentHash='f'.repeat(64);expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:fresh})).not.toThrow();expect(cached.manifest.items[0]!.syncStudioPresentation).toBeUndefined();
});

it('retains the latest verified Source dataset when metadata disappears or a data revision moves backwards',()=>{
 const cached=connectedFixture();cached.manifest.items[0]!.syncDynamic!.dataRevision=3;const missing=structuredClone(cached);delete missing.manifest.items[0]!.syncDynamic;delete missing.manifest.syncSystemAssets;
 expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:missing})).toThrow('SYNC_DYNAMIC_PROFILE_UNAVAILABLE');
 const old=structuredClone(cached);old.manifest.items[0]!.syncDynamic!.dataRevision=2;expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:old})).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');
});

it('retains the latest verified complete binary when its data revision moves backwards',()=>{
 const cached=connectedFixture(),item=cached.manifest.items[0]!,metadata=item.syncDynamic!;
 item.syncDynamicBinary={schemaVersion:metadata.schemaVersion,configurationSnapshotId:metadata.configurationSnapshotId,snapshotId:metadata.snapshotId,templateVersionId:metadata.templateVersionId,configurationHash:metadata.configurationHash,contentHash:metadata.contentHash,fallbackChecksumSha256:item.source.checksumSha256,durationMs:metadata.durationMs,dataRevision:4};delete item.syncDynamic;delete cached.manifest.syncSystemAssets;
 const stale=structuredClone(cached);stale.manifest.items[0]!.syncDynamicBinary!.dataRevision=3;expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:stale})).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');expect(cached.manifest.items[0]!.syncDynamicBinary!.dataRevision).toBe(4);
});


describe("approved scene preparation", () => {
  for (const profile of ["studio", "connected"] as const) it(`${profile}: requires exactly the referenced approved scene before playback`, () => {
    const value = profile === "studio" ? fixture() : connectedFixture(), item = value.manifest.items[0]!;
    const presentation = item.syncDynamic?.presentation ?? item.syncStudioPresentation!;
    const asset = syncBackgroundAssets[0]!;
    presentation.style = { ...presentation.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } };
    expect(() => getCacheableAssets(value.manifest)).toThrow("SYNC_ASSET_MANIFEST_INVALID");
    value.manifest.syncSystemAssets!.push({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType });
    const assets = getCacheableAssets(value.manifest);
    expect(assets.filter(ref => ref.itemId === "sync-v1")).toHaveLength(12);
    expect(assets.some(ref => ref.checksumSha256 === asset.sha256)).toBe(true);
    item.syncSystemAssetUrls = Object.fromEntries(syncSystemAssets.map(ref => [ref.path, prepared(ref.sha256)]));
    expect(syncPreparedPresentation(item, origin)).toBe(false);
    item.syncSystemAssetUrls[asset.path] = `https://player.veyocast.nl${asset.path}`;
    expect(syncPreparedPresentation(item, origin)).toBe(false);
    item.syncSystemAssetUrls[asset.path] = prepared(asset.sha256);
    expect(syncPreparedPresentation(item, origin)).toBe(true);
    const fresh = structuredClone(value);
    delete fresh.manifest.items[0]!.syncSystemAssetUrls;
    const refreshed = refreshHydratedReleaseEnvelope({ cachedEnvelope: value, freshEnvelope: fresh, online: false });
    expect(refreshed.manifest.items[0]!.syncSystemAssetUrls?.[asset.path]).toBe(prepared(asset.sha256));
  });
  it("rejects unreferenced scenes, substituted descriptors and duplicates without changing the active envelope", () => {
    const old = fixture(), before = JSON.stringify(old);
    for (const property of ["unused", "checksum", "bytes", "mime", "duplicate"]) {
      const next = fixture(), asset = syncBackgroundAssets[0]!, item = next.manifest.items[0]!;
      if (property !== "unused") item.syncStudioPresentation!.style = { ...item.syncStudioPresentation!.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } };
      next.manifest.syncSystemAssets!.push({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType });
      const declared = next.manifest.syncSystemAssets!.at(-1)!;
      if (property === "checksum") declared.checksumSha256 = "a".repeat(64);
      if (property === "bytes") declared.bytes += 1;
      if (property === "mime") declared.mimeType = "image/png";
      if (property === "duplicate") next.manifest.syncSystemAssets!.push({ ...declared });
      expect(() => getCacheableAssets(next.manifest)).toThrow("SYNC_ASSET_MANIFEST_INVALID");
      expect(JSON.stringify(old)).toBe(before);
    }
  });
});
