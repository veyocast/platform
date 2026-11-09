import { describe, expect, it, vi } from "vitest";
import { supportsSyncDomV2,readSyncDynamicMode,supportsSyncBackgrounds, supportsSyncSlideDom } from "./sync-player-capabilities";
import {
  syncSlidePresentationSchema,
  syncSystemAssets,
  syncBackgroundAssets,
  syncSlideRendererAssets,
  syncSlideMinimumDurationMs,
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
  prepareSyncOnzeTrotsFonts,
} from "./sync-player-presentation";
import sitesAssets from "../../../../packages/content-templates/src/sites-system-assets.json";
import { assertSyncDynamicEnvelopeContinuity } from "./sync-player-assets";
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
const markerPath = "/onzetrots-approved-v1/assets/fonts/club-font-9.ttf";
const markerHash = "a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c";
function onzeTrotsPresentation(version: "sync-onzetrots-v1" | "sync-onzetrots-v9", font = "Inter", fontChanged = false) {
  return syncSlidePresentationSchema.parse({
    schemaVersion: 1, rendererVersion: version,
    sourceRevision: version === "sync-onzetrots-v9" ? "5ba52a657d6d16ad103ba2fb43b8db18aa83715a" : "ae83f2b4312408eacae9f29177d3c743e104185b",
    family: "welcome", orientation: "landscape", theme: "onzetrots-tv", name: "Onze trots", title: "Welkom", club: { name: "Eigen club" },
    visual: { schemaVersion: 1, mode: "light" }, style: { font, fontChanged },
  });
}

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
  for (const version of ["sync-onzetrots-v1", "sync-onzetrots-v9"] as const) {
    for (const [font, fontChanged] of [["Inter", false], ["Serif", true], ["Brush", true]] as const) {
      it(`${version} ${font}/${fontChanged}: downloads and loads the checksum-bound header face offline`, async () => {
        try {
          const slide = onzeTrotsPresentation(version, font, fontChanged), value = fixture();
          const assets = syncSlideRendererAssets(slide);
          expect(assets.filter(asset => asset.path === markerPath)).toEqual([{ path: markerPath, sha256: markerHash, bytes: 73276, mimeType: "font/ttf" }]);
          value.manifest.items[0]!.syncStudioPresentation = slide;
          value.manifest.items[0]!.syncStudioDurationMs = syncSlideMinimumDurationMs(slide);
          value.manifest.syncSystemAssets = assets.map(asset => ({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType }));
          expect(getCacheableAssets(value.manifest).some(asset => asset.cacheKey === prepared(markerHash))).toBe(true);
          const state = setup(), urls = Object.fromEntries(assets.map(asset => [asset.path, prepared(asset.sha256)]));
          const preparation = prepareSyncOnzeTrotsFonts(urls, origin, slide);
          await preparation.ready;
          expect(state.created.some(face => face.family === "OTMarker" && face.descriptors.weight === "400" && face.source.includes(prepared(markerHash)) && face.status === "loaded")).toBe(true);
          expect(state.created.map(face => face.family)).toEqual(expect.arrayContaining(["OTManrope", "OTBarlow", ...(version === "sync-onzetrots-v9" ? ["OTRubikDistressed"] : [])]));
          expect(state.created.every(face => face.source.includes("/__veyocast-player-cache/"))).toBe(true);
          expect(state.globalLoad).not.toHaveBeenCalled();
          preparation.dispose(); expect([...state.registered]).toEqual([state.globalFace]);
        } finally { vi.unstubAllGlobals(); }
      });
    }
  }
  it("waits for the v9 header face even when the other cached fonts have loaded", async () => {
    let finishMarker: (() => void) | undefined;
    try {
      const slide = onzeTrotsPresentation("sync-onzetrots-v9");
      const state = setup(face => face.family === "OTMarker" ? new Promise(resolve => { finishMarker = () => { face.status = "loaded"; resolve(face); }; }) : Promise.resolve(Object.assign(face, { status: "loaded" })));
      const urls = { ...Object.fromEntries(syncSlideRendererAssets(slide).map(asset => [asset.path, prepared(asset.sha256)])), [markerPath]: prepared(markerHash) };
      const preparation = prepareSyncOnzeTrotsFonts(urls, origin, slide);
      let ready = false; void preparation.ready.then(() => { ready = true; });
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      expect(ready).toBe(false); expect(finishMarker).toBeTypeOf("function");
      finishMarker!(); await preparation.ready;
      expect(ready).toBe(true); preparation.dispose(); expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("rejects a failed v9 header face and removes the partially prepared body fonts", async () => {
    try {
      const slide = onzeTrotsPresentation("sync-onzetrots-v9");
      const state = setup(face => face.family === "OTMarker" ? Promise.reject(Error("cached marker decode failed")) : Promise.resolve(Object.assign(face, { status: "loaded" })));
      const urls = { ...Object.fromEntries(syncSlideRendererAssets(slide).map(asset => [asset.path, prepared(asset.sha256)])), [markerPath]: prepared(markerHash) };
      await expect(prepareSyncOnzeTrotsFonts(urls, origin, slide).ready).rejects.toThrow("cached marker decode failed");
      expect([...state.registered]).toEqual([state.globalFace]);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("independent Sync Player cache protocol", () => {
  it('prepares a mixed historical/approved release with all six approved font faces and checksum-bound nested images',()=>{
    const value=fixture(),legacy=value.manifest.items[0]!,modern=structuredClone(legacy),imageId='28500000-0000-4000-8000-000000000901';
    modern.id='28500000-0000-4000-8000-000000000902';
    modern.syncStudioPresentation=syncSlidePresentationSchema.parse({...modern.syncStudioPresentation,rendererVersion:'sync-onzetrots-v1',sourceRevision:'ae83f2b4312408eacae9f29177d3c743e104185b',theme:'onzetrots-tv',visual:{schemaVersion:1,mode:'dark'},rich:{featureImage:{kind:'tenant',mediaAssetId:imageId,checksumSha256:'d'.repeat(64)}}});
    modern.syncStudioAssets={[imageId]:{url:'https://media.example/verified-photo.png',bytes:100,mimeType:'image/png',checksumSha256:'d'.repeat(64)}};
    value.manifest.items.push(modern);
    const approved=syncSlideRendererAssets(modern.syncStudioPresentation),union=[...syncSystemAssets,...approved];
    value.manifest.syncSystemAssets=[...new Map(union.map(asset=>[asset.path,asset])).values()].map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));
    expect(approved.filter(asset=>asset.mimeType.startsWith('font/'))).toHaveLength(6);
    const cached=getCacheableAssets(value.manifest);
    for(const asset of union)expect(cached.some(ref=>ref.checksumSha256===asset.sha256)).toBe(true);
    expect(cached.some(ref=>ref.checksumSha256==='d'.repeat(64))).toBe(true);
    expect(syncSlideRendererAssets(legacy.syncStudioPresentation!)).toEqual(syncSystemAssets);
    modern.syncSystemAssetUrls=Object.fromEntries(approved.map(asset=>[asset.path,prepared(asset.sha256)]));
    expect(syncPreparedPresentation(modern,origin)).toBe(false);
    modern.syncStudioAssets[imageId]!.url=prepared('d'.repeat(64));expect(syncPreparedPresentation(modern,origin)).toBe(true);
    const css=syncPreparedCss(modern.syncSystemAssetUrls,origin,modern.syncStudioPresentation);expect(css).toContain('OTMarker');expect(css).not.toMatch(/url\(['"]?\/onzetrots-approved-v1/);
    const font=approved.find(asset=>asset.mimeType.startsWith('font/'))!;
    value.manifest.syncSystemAssets=value.manifest.syncSystemAssets.filter(asset=>asset.path!==font.path);
    expect(()=>getCacheableAssets(value.manifest)).toThrow('SYNC_ASSET_MANIFEST_INVALID');
  });
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
 if(item.syncDynamic?.schemaVersion!==1)throw Error('Expected the strict legacy fixture');item.syncDynamic.fallbackChecksumSha256='f'.repeat(64);expect(syncPreparedPresentation(item,origin)).toBe(false);expect(()=>getCacheableAssets(value.manifest)).toThrow('SYNC_DYNAMIC_PRESENTATION_INVALID');
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
 if(metadata.schemaVersion!==1)throw Error('Expected the strict legacy fixture');
 item.syncDynamicBinary={schemaVersion:metadata.schemaVersion,configurationSnapshotId:metadata.configurationSnapshotId,snapshotId:metadata.snapshotId,templateVersionId:metadata.templateVersionId,configurationHash:metadata.configurationHash,contentHash:metadata.contentHash,fallbackChecksumSha256:item.source.checksumSha256,durationMs:metadata.durationMs,dataRevision:4};delete item.syncDynamic;delete cached.manifest.syncSystemAssets;
 const stale=structuredClone(cached);stale.manifest.items[0]!.syncDynamicBinary!.dataRevision=3;expect(()=>refreshHydratedReleaseEnvelope({cachedEnvelope:cached,freshEnvelope:stale})).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');expect(cached.manifest.items[0]!.syncDynamicBinary!.dataRevision).toBe(4);
});

for(const zoneId of ['side','bottom']as const)it(`rejects stale ${zoneId} Source revisions before a candidate can be replaced`,()=>{
 const current=connectedFixture(),child=connectedFixture();child.manifest.releaseId='10000000-0000-4000-8000-000000000295';
 current.composition={published:{id:'20000000-0000-4000-8000-000000000295',revision:1,configuration:{schemaVersion:1,layout:zoneId==='side'?'sidebar':'bottom',orientation:'landscape',mainWidthPercent:70,bottomHeightPercent:20,zones:[{id:'main',playlistId:current.manifest.playlistId},{id:zoneId,playlistId:child.manifest.playlistId}]},bindings:[{zoneId:'main',playlistId:current.manifest.playlistId,releaseId:current.manifest.releaseId,publicationId:'30000000-0000-4000-8000-000000000295',configRevision:1},{zoneId,playlistId:child.manifest.playlistId,releaseId:child.manifest.releaseId,publicationId:'40000000-0000-4000-8000-000000000295',configRevision:1}]},zones:{[zoneId]:child}};
 child.manifest.items[0]!.syncDynamic!.dataRevision=2;
 const stale=structuredClone(current);stale.composition!.zones[zoneId]!.manifest.items[0]!.syncDynamic!.dataRevision=1;
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,stale)).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');
 const differentMain=structuredClone(stale);differentMain.manifest.releaseId='60000000-0000-4000-8000-000000000295';
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,differentMain)).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');
 const collision=structuredClone(current);collision.composition!.zones[zoneId]!.manifest.items[0]!.syncDynamic!.contentHash='e'.repeat(64);
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,collision)).toThrow('SYNC_DYNAMIC_DATA_REVISION_COLLISION');
 const newer=structuredClone(current);newer.composition!.zones[zoneId]!.manifest.items[0]!.syncDynamic!.dataRevision=3;
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,newer)).not.toThrow();
 // Revision ordering belongs to this publication and zone, never another one.
 stale.composition!.zones[zoneId]!.manifest.releaseId='50000000-0000-4000-8000-000000000295';
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,stale)).not.toThrow();
});

function legacyRevisionFixture(){
 const value=fixture(),item=value.manifest.items[0]!;delete item.syncStudioPresentation;delete item.syncStudioDurationMs;delete item.syncStudioAssets;delete value.manifest.syncSystemAssets;
 const snapshot='10000000-0000-4000-8000-000000000626',template='20000000-0000-4000-8000-000000000626';
 item.dynamicTemplate={schemaVersion:1,snapshotId:snapshot,templateVersionId:template,templateSlug:'historical-news',snapshotHash:'b'.repeat(64),orientation:'landscape',slideType:'news',data:{},assets:{}};
 item.dynamicData={schemaVersion:1,configurationSnapshotId:snapshot,snapshotId:snapshot,templateVersionId:template,configurationHash:'a'.repeat(64),contentHash:'b'.repeat(64),dataRevision:2};return value;
}
it('keeps supported historical payloads and binds additive source identity outside their strict facts',()=>{
 const value=legacyRevisionFixture();expect(()=>getCacheableAssets(value.manifest)).not.toThrow();const old=structuredClone(value);delete old.manifest.items[0]!.dynamicData;
 expect(()=>getCacheableAssets(old.manifest)).not.toThrow();expect(()=>assertSyncDynamicEnvelopeContinuity(old,value)).not.toThrow();
 expect(()=>assertSyncDynamicEnvelopeContinuity(value,old)).toThrow('SYNC_DYNAMIC_PROFILE_UNAVAILABLE');
});
for(const invalid of ['revision-zero','revision-string','snapshot','configuration-snapshot','template','hash','unknown-field']as const)it(`rejects invalid historical source metadata (${invalid}) before assets or a candidate can replace verified facts`,()=>{
 const value=legacyRevisionFixture(),item=value.manifest.items[0]!,metadata=item.dynamicData!;
 if(invalid==='revision-zero')metadata.dataRevision=0;
 else if(invalid==='revision-string')Object.assign(metadata,{dataRevision:'3'});
 else if(invalid==='snapshot')metadata.snapshotId='30000000-0000-4000-8000-000000000626';
 else if(invalid==='configuration-snapshot')metadata.configurationSnapshotId='30000000-0000-4000-8000-000000000626';
 else if(invalid==='template')metadata.templateVersionId='30000000-0000-4000-8000-000000000626';
 else if(invalid==='hash')metadata.contentHash='c'.repeat(64);
 else Object.assign(metadata,{unchecked:true});
 expect(()=>getCacheableAssets(value.manifest)).toThrow('DYNAMIC_DATA_IDENTITY_INVALID');
});
it('rejects historical revision regression and collisions while accepting a real correction back to an earlier fact hash',()=>{
 const current=legacyRevisionFixture(),stale=structuredClone(current);stale.manifest.items[0]!.dynamicData!.dataRevision=1;
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,stale)).toThrow('SYNC_DYNAMIC_DATA_REVISION_REGRESSED');
 const corrected=structuredClone(current);corrected.manifest.items[0]!.dynamicData!.contentHash='c'.repeat(64);corrected.manifest.items[0]!.dynamicTemplate!.snapshotHash='c'.repeat(64);
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,corrected)).toThrow('SYNC_DYNAMIC_DATA_REVISION_COLLISION');
 corrected.manifest.items[0]!.dynamicData!.dataRevision=3;expect(()=>assertSyncDynamicEnvelopeContinuity(current,corrected)).not.toThrow();
 corrected.manifest.items[0]!.dynamicData!.contentHash=current.manifest.items[0]!.dynamicData!.contentHash;corrected.manifest.items[0]!.dynamicTemplate!.snapshotHash=current.manifest.items[0]!.dynamicTemplate!.snapshotHash;
 expect(()=>assertSyncDynamicEnvelopeContinuity(current,corrected)).not.toThrow();
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

it('prepares the verified Marker dependency for every saved OnzeTrots v9 font choice',()=>{
 const old=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-onzetrots-v9',sourceRevision:'5ba52a657d6d16ad103ba2fb43b8db18aa83715a',family:'menu',orientation:'portrait',theme:'onzetrots-tv',name:'Menu',title:'Onze kaart',club:{name:'Eigen club'},visual:{schemaVersion:1,mode:'light'},style:{}});
 const current=syncSlidePresentationSchema.parse({...old,style:{...old.style,font:'Brush',fontChanged:true}});
 const custom=syncSlidePresentationSchema.parse({...old,style:{...old.style,font:'Serif',fontChanged:true}});
 for(const slide of [old,current,custom]){
  const urls=Object.fromEntries(syncSlideRendererAssets(slide).map(asset=>[asset.path,`blob:http://localhost/${asset.sha256}`]));
  const css=syncPreparedCss(urls,'http://localhost',slide);
  const markerFace=css.match(/@font-face\s*\{[^}]+\}/g)?.find(face=>/font-family:\s*['"]?OTMarker(?:['"]|;|\s)/.test(face));
  expect(markerFace).toContain(`blob:http://localhost/${markerHash}`);
  expect(css).not.toMatch(/url\(['"]?\//);
 }
 const urls=Object.fromEntries(syncSlideRendererAssets(old).map(asset=>[asset.path,`blob:http://localhost/${asset.sha256}`]));
 delete urls[markerPath];
 for(const slide of [old,current,custom])expect(()=>syncPreparedCss(urls,'http://localhost',slide)).toThrow('SYNC_PREPARED_ASSET_UNAVAILABLE');
});

it('advertises DOM v2 only with real rendering, integrity, offline-storage and service-worker APIs',()=>{
 try{
  expect(readSyncDynamicMode('sync-dynamic-v2')).toBe('dom-v2');expect(readSyncDynamicMode('sync-dynamic-v9')).toBe(false);
  vi.stubGlobal('window',{});vi.stubGlobal('CSS',{supports:()=>true});vi.stubGlobal('ResizeObserver',class{});
  vi.stubGlobal('document',{fonts:{load(){},add(){},delete(){}}});vi.stubGlobal('FontFace',class{load(){}});vi.stubGlobal('Image',class{decode(){}});
  vi.stubGlobal('SVGForeignObjectElement',class{});vi.stubGlobal('Element',class{getAnimations(){return[];}});
  vi.stubGlobal('crypto',{subtle:{digest(){}}});vi.stubGlobal('indexedDB',{});vi.stubGlobal('caches',{open(){}});vi.stubGlobal('navigator',{serviceWorker:{}});
  expect(supportsSyncDomV2()).toBe(true);
  vi.stubGlobal('navigator',{userAgent:'Brand new browser'});expect(supportsSyncDomV2()).toBe(false);
  vi.stubGlobal('navigator',{serviceWorker:{}});vi.stubGlobal('crypto',{});expect(supportsSyncDomV2()).toBe(false);
 }finally{vi.unstubAllGlobals();}
});
