import { describe, expect, it } from "vitest";
import { syncBackgroundScenes, syncSlidePresentationSchema } from "@veyocast/contracts";
import { chooseSyncBackground, orientSyncBackground, syncBackgroundPresets } from "./sync-background-choice";
const fixture = () => syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-v1", sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", family: "free", theme: "onzetrots-tv", orientation: "landscape", name: "Naam", title: "Titel", club: { name: "Club" }, style: { accent: "#006D83", motion: "geen" } });
describe("explicit background authoring", () => {
  it("pairs every scene only after explicit orientation changes, preserving facts and independent style", () => {
    for (const scene of syncBackgroundScenes) {
      const original = fixture(), before = JSON.stringify(original);
      const selected = { ...original, ...chooseSyncBackground(original, scene.id) };
      const portrait = { ...selected, ...orientSyncBackground(selected, "portrait") };
      expect(selected.style.backgroundAsset).toEqual({ kind: "system", path: scene.landscape.path, checksumSha256: scene.landscape.sha256 });
      expect(portrait.style.backgroundAsset).toEqual({ kind: "system", path: scene.portrait.path, checksumSha256: scene.portrait.sha256 });
      expect({ ...portrait, orientation: original.orientation, style: original.style }).toEqual(original);
      expect(portrait.style.accent).toBe(original.style.accent);
      expect(JSON.stringify(original)).toBe(before);
      expect(orientSyncBackground(portrait, "portrait")).toEqual({ orientation: "portrait" });
      expect({ ...portrait, ...orientSyncBackground(portrait, "landscape") }).toEqual(selected);
    }
  });
  it("preserves private photos and fixed presets and clears a photo only after a preset click", () => {
    const value = fixture(); value.style.background = "photo";
    value.style.backgroundAsset = { kind: "tenant", mediaAssetId: "10000000-0000-4000-8000-000000000238", checksumSha256: "a".repeat(64) };
    expect(orientSyncBackground(value, "portrait")).toEqual({ orientation: "portrait" });
    for (const [preset] of syncBackgroundPresets) {
      const changed = chooseSyncBackground(value, preset);
      expect(changed.style).toEqual({ ...value.style, background: preset, backgroundAsset: undefined });
      expect(value.style.backgroundAsset.kind).toBe("tenant");
    }
  });
});
