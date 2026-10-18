import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings, syncSystemAssets } from "@veyocast/contracts";
import type { PlaylistStudioData } from "./data";
import type { MediaFramePlacement } from "./_components/sites/model";

const f = vi.hoisted(() => ({ client: vi.fn(), frames: vi.fn() }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("./library", () => ({ loadMediaFramePlacements: f.frames }));
import { loadPublicationMediaPreview, projectPublicationMediaPreview } from "./publish-media-frame-preview.server";

const id = (n: number) => `19170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Item = PlaylistStudioData["items"][number];
const mainHash = "a".repeat(64), bgHash = "b".repeat(64);
const binding = (): MediaFramePlacement => ({ frameId: id(20), pinnedVersionId: id(1), pinnedVersionNumber: 1, selected: {
  id: id(1), number: 1, settings: { ...mediaFrameDefaultSettings({ kind: "image", title: "Vast ontwerp", durationSeconds: null }), durationSeconds: 901, fitMode: "contain", focus: "right", appearance: { themeId: "fieldflow", accentColor: "#123332", background: { kind: "image", mediaAssetId: id(31), position: "right" } } },
  mediaAssetId: id(30), checksumSha256: mainHash, byteSize: 100, image: "https://private.test/frozen-main?temporary-access", kind: "image", backgroundImage: "https://private.test/frozen-bg?temporary-access", backgroundChecksumSha256: bgHash, backgroundByteSize: 50,
}, current: null, overrides: {}, fitMode: "contain", cropFocusX: 1, cropFocusY: 0.5, backgroundColor: null });
const item = (n = 100): Item => ({ id: id(n), mediaAssetId: id(30), mediaFrameId: id(20), mediaFrameVersionId: id(1), mediaFrameOverrides: {}, sectionId: null, enabled: true, durationSeconds: 901, fitMode: "contain", cropFocusX: 1, cropFocusY: 0.5, backgroundColor: null, displayTitle: "Vast ontwerp", muted: true, asset: { kind: "image", title: "Huidige fysieke titel", variant: { previewUrl: "https://private.test/preferred-today", checksumSha256: "c".repeat(64), fileSizeBytes: 777 } } } as unknown as Item);
const run = (items = [item()], values = new Map([[id(100), binding()]])) => projectPublicationMediaPreview(items, new Set(), values);
beforeEach(() => { f.client.mockReset(); f.frames.mockReset(); });

describe("publication from verified pinned media sources", () => {
  it("uses the pinned old main/background instead of current frame or preferred variant", () => {
    const frame = binding(); frame.current = { ...frame.selected, id: id(2), number: 2, image: "https://private.test/new-main", backgroundImage: "https://private.test/new-bg", backgroundChecksumSha256: "d".repeat(64), backgroundByteSize: 999 };
    const result = run([item()], new Map([[id(100), frame]]));
    expect(result.targetItems).toEqual([{ checksumSha256: mainHash, fileSizeBytes: 100 }, { checksumSha256: bgHash, fileSizeBytes: 50 }]); expect(result.totalBytes).toBe(150);
    expect(result.previewItems[0]).toMatchObject({ durationSeconds: 901, url: frame.selected.image, mediaFrameStyle: { objectFit: "contain", objectPosition: "100% 50%", backgroundPosition: "right" } });
    expect(result.previewItems[0]!.mediaFrameStyle!.backgroundImage).toContain("frozen-bg"); expect(JSON.stringify(result)).not.toContain("preferred-today"); expect(JSON.stringify(result)).not.toContain("new-bg");
  });
  it("counts each physical checksum once across primary and copied placements", () => {
    const result = run([item(), item(101)], new Map([[id(100), binding()], [id(101), binding()]]));
    expect(result.targetItems).toHaveLength(2); expect(result.totalBytes).toBe(150); expect(result.previewItems).toHaveLength(2);
  });
  it("includes a distinct copied background once while sharing the same main checksum", () => {
    const copy = binding(); copy.selected.backgroundChecksumSha256 = "e".repeat(64); copy.selected.backgroundByteSize = 25;
    const result = run([item(), item(101)], new Map([[id(100), binding()], [id(101), copy]])); expect(result.targetItems).toHaveLength(3); expect(result.totalBytes).toBe(175);
  });
  it.each([null, "#ffffff"])("explicit color override %s suppresses every hidden background asset/style", color => {
    const frame = binding(); frame.overrides.backgroundColor = true; frame.backgroundColor = color; frame.selected.backgroundByteSize = undefined; frame.selected.backgroundImage = undefined;
    const result = run([item()], new Map([[id(100), frame]])); expect(result.targetItems).toEqual([{ checksumSha256: mainHash, fileSizeBytes: 100 }]);
    expect(result.previewItems[0]!.mediaFrameStyle).toEqual({ background: color ?? "var(--vc-brand-ink-black)", objectFit: "contain", objectPosition: "100% 50%" }); expect(JSON.stringify(result.previewItems)).not.toContain("frozen-bg");
  });
  it("includes the locked clubmuur checksum/bytes from the canonical descriptor", () => {
    const frame = binding(); frame.selected.settings.appearance.background = { kind: "preset", preset: "clubmuur" }; const locked = syncSystemAssets.find(asset => asset.path === "/assets/clubmuur-wall.webp")!;
    const result = run([item()], new Map([[id(100), frame]])); expect(result.targetItems).toEqual([{ checksumSha256: mainHash, fileSizeBytes: 100 }, { checksumSha256: locked.sha256, fileSizeBytes: locked.bytes }]); expect(result.previewItems[0]!.mediaFrameStyle!.backgroundImage).toContain(locked.path);
  });
  it.each(["stadium", "dark", "light", "gradient", "stripes"] as const)("preset %s adds its real Source style without invented asset bytes", preset => {
    const frame = binding(); frame.selected.settings.appearance.background = { kind: "preset", preset }; const result = run([item()], new Map([[id(100), frame]])); expect(result.targetItems).toHaveLength(1); expect(result.totalBytes).toBe(100); expect(result.previewItems[0]!.mediaFrameStyle!.background).toBeTruthy();
  });
  it.each(["byteSize", "backgroundByteSize", "backgroundImage", "backgroundChecksumSha256"] as const)("fails closed when the verified frozen %s is absent", field => {
    const frame = binding(); delete frame.selected[field]; expect(() => run([item()], new Map([[id(100), frame]]))).toThrow("vastgezette");
  });
  it("rejects a mismatched pin/source and a partial or missing frame binding", () => {
    const frame = binding(); frame.selected.mediaAssetId = id(99); expect(() => run([item()], new Map([[id(100), frame]]))).toThrow();
    expect(() => run([item()], new Map())).toThrow(); expect(() => run([{ ...item(), mediaFrameId: null }], new Map([[id(100), binding()]]))).toThrow();
  });
  it("does not add downloads for disabled items or sections", () => {
    const result = run([{ ...item(), enabled: false }, { ...item(101), sectionId: id(90) }], new Map([[id(100), binding()], [id(101), binding()]])); expect(result.targetItems).toEqual([]); expect(result.totalBytes).toBe(0);
  });
  it("deduplicates mixed frame/legacy assets but rejects conflicting sizes for the same hash", () => {
    const legacy = { ...item(102), mediaFrameId: null, mediaFrameVersionId: null }; legacy.asset!.variant!.checksumSha256 = mainHash; legacy.asset!.variant!.fileSizeBytes = 100;
    expect(run([item(), legacy]).targetItems).toHaveLength(2); legacy.asset!.variant!.fileSizeBytes = 999; expect(() => run([item(), legacy])).toThrow();
  });
  it("keeps unbound projection unchanged and never invokes the new client/library boundary", async () => {
    const legacy = { ...item(), mediaFrameId: null, mediaFrameVersionId: null }; const result = await loadPublicationMediaPreview(id(10), [legacy, legacy], new Set());
    expect(f.client).not.toHaveBeenCalled(); expect(f.frames).not.toHaveBeenCalled(); expect(result.hasFrames).toBe(false); expect(result.targetItems).toHaveLength(2); expect(result.previewItems[0]!.url).toBe(legacy.asset!.variant!.previewUrl); expect(result.previewItems[0]).not.toHaveProperty("mediaFrameStyle");
  });
  it("loads explicit pinned identities without requireCurrent or an implicit version refresh", async () => {
    const client = {}; f.client.mockResolvedValue(client); f.frames.mockResolvedValue(new Map([[id(100), binding()]])); const items = [item()]; await loadPublicationMediaPreview(id(10), items, new Set()); expect(f.frames).toHaveBeenCalledExactlyOnceWith(client, id(10), items);
  });
});
