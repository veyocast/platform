import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { syncBackgroundAssets, syncBackgroundScenes, syncBackgroundAssetForRef } from "../src/sync-background-catalog";
import { syncSlidePresentationSchema, syncSlideAssetSchema } from "../src/sync-slide-presentation";
import { syncSystemAssets } from "../src/sync-system-assets";
import { syncContentFamilies } from "../src/sync-content-families";

const fixture = () => syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-v1", sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", family: "free", theme: "onzetrots-tv", orientation: "landscape", name: "Eigen ontwerp", title: "Eigen titel", club: { name: "Club" }, style: {} });
describe("approved background-only catalog", () => {
  it("binds all six descriptors to the unchanged approved bytes in both apps", () => {
    expect(syncSystemAssets).toHaveLength(11);
    expect(syncBackgroundAssets).toHaveLength(6);
    expect(new Set(syncBackgroundAssets.map(asset => asset.path)).size).toBe(6);
    expect(syncBackgroundScenes.map(scene => scene.label)).toEqual(["Houtrust", "De wijk", "Aan zee"]);
    for (const asset of syncBackgroundAssets) for (const app of ["control", "player"]) {
      const bytes = readFileSync(new URL(`../../../apps/${app}/public${asset.path}`, import.meta.url));
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 16)).toBe("WEBPVP8 ");
      expect(bytes.subarray(23, 26).toString("hex")).toBe("9d012a");
      expect(bytes.readUInt16LE(26) & 0x3fff).toBe(asset.width);
      expect(bytes.readUInt16LE(28) & 0x3fff).toBe(asset.height);
      expect(asset.mimeType).toBe("image/webp");
    }
  });
  it("accepts both scene orientations for every existing family without rewriting facts or identity", () => {
    for (const { id: family } of syncContentFamilies) for (const scene of syncBackgroundScenes) for (const orientation of ["landscape", "portrait"] as const) {
      const asset = scene[orientation], value = fixture();
      value.family = family; value.orientation = orientation;
      value.style = { ...value.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } };
      expect(syncSlidePresentationSchema.parse(value)).toEqual(value);
      expect(syncBackgroundAssetForRef(value.style.backgroundAsset)).toEqual(asset);
    }
  });
  it("rejects scene assets in every logo role even when the same ref is also the background", () => {
    for (const asset of syncBackgroundAssets) {
      const ref = { kind: "system" as const, path: asset.path, checksumSha256: asset.sha256 };
      expect(syncSlideAssetSchema.safeParse(ref).success).toBe(false);
      const wrongStyle = fixture(); wrongStyle.style.backgroundAsset = ref;
      expect(syncSlidePresentationSchema.safeParse(wrongStyle).success).toBe(false);
      for (const role of ["club", "home", "away"] as const) {
        const value = fixture(); value.style = { ...value.style, background: "photo", backgroundAsset: ref };
        if (role === "club") value.club = { name: "Club", tagline: "", logo: ref };
        else value[role] = { name: "Club", team: "", logo: ref };
        expect(syncSlidePresentationSchema.safeParse(value).success).toBe(false);
      }
    }
  });
  it("rejects guessed paths, foreign images, URLs and substituted checksums", () => {
    const asset = syncBackgroundAssets[0]!, original = { kind: "system", path: asset.path, checksumSha256: asset.sha256 };
    for (const ref of [{ ...original, checksumSha256: "a".repeat(64) }, ...[`${asset.path}?x`, `${asset.path}#x`, `${asset.path}/../x`, `https://example.org${asset.path}`, "/onzetrots/duindorp-logo.svg"].map(path => ({ ...original, path }))]) {
      const value = fixture(); value.style.background = "photo"; value.style.backgroundAsset = ref as typeof value.style.backgroundAsset;
      expect(syncSlidePresentationSchema.safeParse(value).success).toBe(false);
      expect(syncBackgroundAssetForRef(ref)).toBeUndefined();
    }
  });
});
