import { describe, expect, it, vi } from "vitest";
import type { MediaFrameProvenance } from "@veyocast/contracts";
import { readPlayerMediaFramePayload } from "./player-media-frame-payload";
const id = (n: number) => `19170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(10), asset = id(20), background = id(30);
const source = { storageBucket: "tenant-media", storagePath: `tenants/${tenant}/assets/${asset}/original.png`, checksumSha256: "a".repeat(64), bytes: 1234, mimeType: "image/png" };
function frozen(): MediaFrameProvenance {
  return { schemaVersion: 1, tenantId: tenant, frameId: id(40), versionId: id(41), versionNumber: 1, overrides: {},
    settings: { schemaVersion: 1, name: "Eerste bevroren ontwerp", orientation: "portrait", durationSeconds: 23, fitMode: "contain", focus: "bottom", appearance: { themeId: "fieldflow", accentColor: "#123456", background: { kind: "image", mediaAssetId: background, position: "right" } }, sourceMetadata: { title: "", headline: "", subtitle: "", body: "", footer: "", font: "Arial", scale: 100, alignment: "left", safeMargin: 5, showLogo: false, showFooter: false, motion: "geen" } },
    sourceAssets: [{ role: "media", mediaAssetId: asset, variantId: id(21), checksumSha256: source.checksumSha256, byteSize: source.bytes, storageBucket: "tenant-media", storagePath: source.storagePath, mimeType: "image/png", width: 1920, height: 1080, durationSeconds: null }, { role: "background", mediaAssetId: background, variantId: id(31), checksumSha256: "b".repeat(64), byteSize: 2345, storageBucket: "tenant-media", storagePath: `tenants/${tenant}/assets/${background}/old-verified.png`, mimeType: "image/png", width: 1280, height: 720, durationSeconds: null }] };
}
describe("frozen media-frame publication payload", () => {
  it("preserves old releases without a new profile or download", async () => {
    const sign = vi.fn();
    expect(await readPlayerMediaFramePayload(null, tenant, source, sign)).toBeUndefined();
    expect(sign).not.toHaveBeenCalled();
  });
  it("resolves the frozen background identity/path/hash and signs only that path", async () => {
    const value = frozen(), sign = vi.fn(async () => "https://storage.test/frozen-signed");
    const result = await readPlayerMediaFramePayload(value, tenant, source, sign);
    expect(sign.mock.calls).toEqual([["tenant-media", value.sourceAssets[1]!.storagePath]]);
    expect(result?.mediaFrameBackground.background).toEqual({ kind: "image", mediaAssetId: background, checksumSha256: "b".repeat(64), position: "right" });
    expect(result?.mediaFrameBackgroundAssets[background]).toEqual({ checksumSha256: "b".repeat(64), bytes: 2345, mimeType: "image/png", url: "https://storage.test/frozen-signed" });
    expect(value.versionNumber).toBe(1);
  });
  it.each(["tenant", "path", "hash", "bytes", "kind"])("rejects changed %s before signing private data", async field => {
    const value = frozen(), sign = vi.fn();
    if (field === "tenant") value.tenantId = id(99);
    if (field === "path") value.sourceAssets[1]!.storagePath = `tenants/${id(99)}/assets/${background}/other.png`;
    if (field === "hash") value.sourceAssets[0]!.checksumSha256 = "c".repeat(64);
    if (field === "bytes") value.sourceAssets[0]!.byteSize += 1;
    if (field === "kind") value.sourceAssets[1]!.mimeType = "video/mp4";
    await expect(readPlayerMediaFramePayload(value, tenant, source, sign)).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });
  it("does not fetch a frozen background when the placement explicitly overrides its color", async () => {
    const value = frozen(), sign = vi.fn();
    value.overrides.backgroundColor = true;
    expect(await readPlayerMediaFramePayload(value, tenant, source, sign)).toBeUndefined();
    expect(sign).not.toHaveBeenCalled();
  });
  it("uses only the locked clubmuur descriptor for that preset", async () => {
    const value = frozen(), sign = vi.fn();
    value.settings.appearance.background = { kind: "preset", preset: "clubmuur" };
    value.sourceAssets = value.sourceAssets.slice(0, 1);
    const result = await readPlayerMediaFramePayload(value, tenant, source, sign);
    expect(result?.mediaFrameBackgroundAssets.clubmuur?.url).toBe("/assets/clubmuur-wall.webp");
    expect(result?.mediaFrameBackgroundAssets.clubmuur?.checksumSha256).toBe("fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310");
    expect(sign).not.toHaveBeenCalled();
  });
});
