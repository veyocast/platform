import { describe, expect, it } from "vitest";
import { mediaFrameCommandSchema, mediaFrameFocusCoordinates, mediaFramePlaybackBackgroundSchema, mediaFrameSettingsSchema, type MediaFrameSettings } from "../src/media-frames";
import { playlistBatchCommandSchema } from "../src/playlist-batch";

const id = (n: number) => `23100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const settings: MediaFrameSettings = {
  schemaVersion: 1, name: "Mijn video", orientation: "portrait", durationSeconds: 240,
  fitMode: "contain", focus: "top",
  appearance: { themeId: "onzetrots-tv", accentColor: "#1763ed", background: { kind: "preset", preset: "stadium" } },
  sourceMetadata: { title: "Titel blijft metadata", headline: "Boventitel", subtitle: "", body: "", footer: "", font: "Arial", scale: 100, alignment: "left", safeMargin: 5, showLogo: true, showFooter: true, motion: "geen" },
};
const source = { role: "media" as const, mediaAssetId: id(2), variantId: id(3), checksumSha256: "a".repeat(64), byteSize: 123_456 };
const create = () => ({ operation: "create" as const, tenantId: id(1), frameId: id(4), idempotencyKey: id(5), expectedRevision: 0 as const, sourceAssetId: id(2), expectedSources: [source], settings });

describe("immutable media frame transport", () => {
  it("preserves a video duration beyond free Studio and prototype limits without clipping", () => {
    const parsed = mediaFrameCommandSchema.parse(create());
    expect(parsed).toEqual(create());
    expect(parsed.operation === "create" && parsed.settings.durationSeconds).toBe(240);
    for (const durationSeconds of [2, 3_601, 12.5, Number.NaN]) expect(mediaFrameSettingsSchema.safeParse({ ...settings, durationSeconds }).success).toBe(false);
  });
  it("binds the selected media and optional background to exact source roles and hashes", () => {
    const background = { ...source, role: "background" as const, mediaAssetId: id(6), variantId: id(7) };
    const withImage = { ...settings, appearance: { ...settings.appearance, background: { kind: "image" as const, mediaAssetId: id(6), position: "left" as const } } };
    expect(mediaFrameCommandSchema.safeParse({ ...create(), settings: withImage, expectedSources: [source, background] }).success).toBe(true);
    for (const patch of [
      { sourceAssetId: id(8) },
      { expectedSources: [background] },
      { expectedSources: [source, source] },
      { expectedSources: [{ ...source, checksumSha256: "not-a-hash" }] },
      { expectedSources: [source, background] },
      { settings: withImage },
    ]) expect(mediaFrameCommandSchema.safeParse({ ...create(), ...patch }).success).toBe(false);
  });
  it("rejects caller-supplied storage paths, signed URLs and unversioned CSS", () => {
    expect(mediaFrameCommandSchema.safeParse({ ...create(), expectedSources: [{ ...source, storagePath: "tenants/foreign/secret.png" }] }).success).toBe(false);
    expect(mediaFrameSettingsSchema.safeParse({ ...settings, appearance: { ...settings.appearance, background: { kind: "image", mediaAssetId: id(6), position: "center", url: "data:image/png;base64,eA==" } } }).success).toBe(false);
    expect(mediaFramePlaybackBackgroundSchema.safeParse({ schemaVersion: 1, themeId: "fieldflow", accentColor: "url(https://foreign.example)", background: { kind: "preset", preset: "stadium" } }).success).toBe(false);
  });
  it("does not allow lifecycle commands to change source or impersonate a save", () => {
    const base = { tenantId: id(1), frameId: id(4), expectedRevision: 2, idempotencyKey: id(5) };
    expect(mediaFrameCommandSchema.safeParse({ ...base, operation: "duplicate", newFrameId: id(6) }).success).toBe(true);
    expect(mediaFrameCommandSchema.safeParse({ ...base, operation: "archive", settings }).success).toBe(false);
    expect(mediaFrameCommandSchema.safeParse({ ...base, operation: "restore", sourceAssetId: id(8) }).success).toBe(false);
  });
  it("maps Source focus without assuming image aspect ratio", () => {
    expect(["center", "top", "bottom", "left", "right"].map(value => mediaFrameFocusCoordinates(value as "center"))).toEqual([{ x: .5, y: .5 }, { x: .5, y: 0 }, { x: .5, y: 1 }, { x: 0, y: .5 }, { x: 1, y: .5 }]);
  });
  it("keeps batch-local identities unique across raw media and logical frames", () => {
    const batch = { playlistId: id(10), expectedRevision: 2, idempotencyKey: id(11), operations: [{ operation: "add_media_frame", clientId: id(12), frameId: id(4), expectedVersionId: id(13) }, { operation: "add_media", clientId: id(12), mediaAssetId: id(2), durationSeconds: 12 }] };
    expect(playlistBatchCommandSchema.safeParse(batch).success).toBe(false);
    batch.operations[1]!.clientId = id(14);
    expect(playlistBatchCommandSchema.safeParse(batch).success).toBe(true);
    expect(playlistBatchCommandSchema.safeParse({ ...batch, operations: [{ operation: "refresh_media_frame", itemId: id(12), expectedPinnedVersionId: id(13), versionId: id(15) }] }).success).toBe(true);
  });
});
