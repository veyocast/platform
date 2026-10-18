import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerMediaStore } from "./player-media-store";
import { demoOnlineDeviceToken, getPlayerManifestForToken } from "./player-manifest";
import { getCacheableAssets, hydratePreparedRelease, preparePendingRelease, refreshHydratedReleaseEnvelope, sha256Hex } from "./player-cache";
import { assertMediaFrameManifest, mediaFrameClubmuurAsset, playerMediaFrameBackgroundStyle, validMediaFrameBackground } from "./player-media-frame";

const assetId = "19170000-0000-4000-8000-000000000012";
class Store implements PlayerMediaStore {
  entries = new Map<string, Response>();
  async delete(key: string) { return this.entries.delete(key); }
  async get(key: string) { return this.entries.get(key)?.clone(); }
  async keys() { return [...this.entries.keys()]; }
  async put(key: string, response: Response) { this.entries.set(key, response.clone()); }
  async resolvePlaybackUrl(key: string) { if (!this.entries.has(key)) throw Error("missing"); return { url: `blob:verified-${key}` }; }
}
async function fixture(backgroundLabel = "default") {
  const result = getPlayerManifestForToken(demoOnlineDeviceToken);
  if (!result.ok) throw Error("fixture");
  const envelope = structuredClone(result.body);
  const main = new TextEncoder().encode("verified-original-media"), background = new TextEncoder().encode(`verified-private-background-${backgroundLabel}`);
  const mainSha = await sha256Hex(main.buffer), backgroundSha = await sha256Hex(background.buffer);
  const item = envelope.manifest.items[0]!;
  item.source = { bytes: main.byteLength, checksumSha256: mainSha, mimeType: "image/png", url: "https://tenant.test/main" };
  item.mediaFrameBackground = { schemaVersion: 1, themeId: "onzetrots-tv", accentColor: "#1763ed", background: { kind: "image", mediaAssetId: assetId, checksumSha256: backgroundSha, position: "left" } };
  item.mediaFrameBackgroundAssets = { [assetId]: { bytes: background.byteLength, checksumSha256: backgroundSha, mimeType: "image/png", url: "https://tenant.test/background" } };
  envelope.manifest.items = [item];
  const store = new Store();
  await store.put(`/__veyocast-player-cache/${mainSha}`, new Response(main, { headers: { "Content-Type": "image/png" } }));
  vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 100_000_000, usage: 0 }) } });
  return { envelope, item, store, main, mainSha, background, backgroundSha };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("media-frame verified playback background", () => {
  it("rejects missing, wrong-hash and extraneous background assets before local reads", async () => {
    const { envelope, item, store } = await fixture();
    const read = vi.spyOn(store, "get");
    item.mediaFrameBackgroundAssets![assetId]!.checksumSha256 = "a".repeat(64);
    expect(await preparePendingRelease({ envelope, store })).toEqual({ ok: false, error: "RELEASE_ASSET_MANIFEST_INVALID" });
    expect(read).not.toHaveBeenCalled();
    delete item.mediaFrameBackgroundAssets![assetId];
    expect(() => assertMediaFrameManifest(envelope.manifest)).toThrow("MEDIA_FRAME_BACKGROUND_INVALID");
  });
  it("checks the locked clubmuur bytes instead of trusting a same-named asset", () => {
    const value = { schemaVersion: 1, themeId: "fieldflow", accentColor: "#123456", background: { kind: "preset", preset: "clubmuur" } };
    const asset = { checksumSha256: mediaFrameClubmuurAsset.sha256, bytes: mediaFrameClubmuurAsset.bytes, mimeType: mediaFrameClubmuurAsset.mimeType, url: mediaFrameClubmuurAsset.path };
    expect(validMediaFrameBackground(value, { clubmuur: asset }, mediaFrameClubmuurAsset)).toBe(true);
    expect(validMediaFrameBackground(value, { clubmuur: { ...asset, bytes: asset.bytes + 1 } }, mediaFrameClubmuurAsset)).toBe(false);
    expect(validMediaFrameBackground(value, { clubmuur: { ...asset, checksumSha256: "b".repeat(64) } }, mediaFrameClubmuurAsset)).toBe(false);
  });
  it("does not damage last-known-good bytes when a new background download is corrupt", async () => {
    const { envelope, store, main, mainSha, background } = await fixture("corrupt");
    const corrupt = new Uint8Array(background.byteLength).fill(88);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(corrupt, { headers: { "Content-Type": "image/png" } })));
    const result = await preparePendingRelease({ envelope, store });
    expect(result).toMatchObject({ ok: false, error: "asset checksum mismatch" });
    expect(new Uint8Array(await (await store.get(`/__veyocast-player-cache/${mainSha}`))!.arrayBuffer())).toEqual(main);
  });
  it("downloads once, hydrates the background locally and prepares again without network", async () => {
    const { envelope, store, background, backgroundSha } = await fixture("offline");
    const fetch = vi.fn(async () => new Response(background, { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetch);
    const prepared = await preparePendingRelease({ envelope, store });
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw Error(prepared.error);
    expect(fetch).toHaveBeenCalledTimes(1);
    const hydrated = await hydratePreparedRelease({ envelope, assets: prepared.assets }, store);
    const local = hydrated.envelope.manifest.items[0]!;
    expect(local.mediaFrameBackgroundAssets![assetId]!.url).toBe(`blob:verified-/__veyocast-player-cache/${backgroundSha}`);
    expect(playerMediaFrameBackgroundStyle(local)?.backgroundImage).toContain("blob:verified-");
    fetch.mockImplementation(async () => { throw Error("offline"); });
    expect((await preparePendingRelease({ envelope, store })).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const fresh = structuredClone(envelope);
    fresh.manifest.items[0]!.mediaFrameBackgroundAssets![assetId]!.url += "?new-signature";
    const refreshed = refreshHydratedReleaseEnvelope({ cachedEnvelope: hydrated.envelope, freshEnvelope: fresh, online: false });
    expect(refreshed.manifest.items[0]!.mediaFrameBackgroundAssets![assetId]!.url).toBe(local.mediaFrameBackgroundAssets![assetId]!.url);
    fresh.manifest.items[0]!.mediaFrameBackground!.accentColor = "#ff0000";
    expect(() => refreshHydratedReleaseEnvelope({ cachedEnvelope: hydrated.envelope, freshEnvelope: fresh })).toThrow("MEDIA_FRAME_IMMUTABLE_BACKGROUND_CHANGED");
  });
  it("does not add a newly introduced enhancement through a same-release URL refresh", async () => {
    const { envelope } = await fixture();
    const cached = structuredClone(envelope);
    delete cached.manifest.items[0]!.mediaFrameBackground;
    delete cached.manifest.items[0]!.mediaFrameBackgroundAssets;
    const refreshed = refreshHydratedReleaseEnvelope({ cachedEnvelope: cached, freshEnvelope: envelope });
    expect(refreshed.manifest.items[0]!.mediaFrameBackground).toBeUndefined();
    expect(refreshed.manifest.items[0]!.mediaFrameBackgroundAssets).toBeUndefined();
    expect(getCacheableAssets(refreshed.manifest)).toHaveLength(1);
  });
});
