import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import { mapContentLibraryRows, type ContentDataClient, type ContentLibraryRow } from "./content-data.server";
const id = (n: number) => `23200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), asset = id(3), frame = id(2), version = id(5), bg = id(8);
const mainPath = `tenants/${tenant}/assets/${asset}/main.webp`, bgPath = `tenants/${tenant}/assets/${bg}/frozen.webp`;
const sign = vi.fn(); let reads: Array<{ table: string; filters: Array<[string, unknown]> }>;
let references: Array<Record<string, unknown>>;
const settings = () => mediaFrameDefaultSettings({ title: "Eigen frame", kind: "image", durationSeconds: null });
function row(overrides: Partial<ContentLibraryRow> = {}): ContentLibraryRow {
  return { id: asset, content_key: `media:${asset}`, title: "Eigen bron", kind: "media", family: "image", status: "ready", archived: false, orientation: "landscape", duration_seconds: 901, updated_at: "2026-10-19T00:00:00Z", width: 1920, height: 1080, preview_asset_id: null, placement: null, revision: null, media_frame_id: null, media_frame_version_id: null, ...overrides };
}
function client(background = false): ContentDataClient {
  return { storage: { from: () => ({ createSignedUrls: sign }) }, from: (table: string) => {
    const read = { table, filters: [] as Array<[string, unknown]> }; reads.push(read);
    let result: Record<string, unknown> = { data: [], error: null };
    if (table === "media_variants") result = { data: [{ asset_id: asset, storage_path: mainPath, variant_type: "original" }], error: null };
    if (table === "studio_project_drafts") result = { data: [{ project_id: id(20), theme: "fieldflow" }], error: null };
    if (table === "media_frame_versions") { const s = settings(); if (background) s.appearance.background = { kind: "image", mediaAssetId: bg, position: "right" }; result = { data: [{ id: version, frame_id: frame, settings_json: s }], error: null }; }
    if (table === "media_frame_version_assets") result = { data: references, error: null };
    const q = { select: () => q, eq: (name: string, value: unknown) => { read.filters.push([name, value]); return q; }, in: (name: string, value: unknown) => { read.filters.push([name, value]); return q; }, like: () => q, order: () => q, then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) }; return q;
  } } as unknown as ContentDataClient;
}
beforeEach(() => {
  vi.resetAllMocks(); reads = [];
  references = [{ version_id: version, role: "media", media_asset_id: asset, storage_bucket: "tenant-media", storage_path: mainPath, mime_type: "image/webp", checksum_sha256: "a".repeat(64) }];
  sign.mockImplementation(async (paths: string[]) => ({ data: paths.map(path => ({ signedUrl: `https://storage.example.test/${path}` })), error: null }));
});

describe("Shared original Content mapping", () => {
  it("preserves physical media, copied frame, menu, dynamic, Studio and original series routes", async () => {
    const input = [row(), row({ status: "processing" }), row({ id: frame, content_key: `media-frame:${frame}`, media_frame_id: frame, media_frame_version_id: version }), row({ id: id(10), content_key: `dynamic:${id(10)}`, kind: "dynamic", family: "menu" }), row({ id: id(11), content_key: `dynamic:${id(11)}`, kind: "dynamic", family: "news" }), row({ id: id(20), content_key: `studio:${id(20)}`, kind: "studio" }), row({ id: id(30), content_key: `series:${id(30)}`, kind: "series" })];
    const mapped = await mapContentLibraryRows(client(), tenant, input);
    expect(mapped.map(item => item.href)).toEqual([`/dashboard/content/media/source/${asset}`, `/dashboard/media?asset=${asset}`, `/dashboard/content/media/${frame}`, `/dashboard/slides/menu-studio/${id(10)}`, `/dashboard/slides/${id(11)}`, `/dashboard/studio/${id(20)}`, `/dashboard/studio/${id(30)}`]);
    expect(mapped.map(item => item.key)).toEqual(input.map(item => item.content_key)); expect(mapped[0]!.duration).toBe(901); expect(mapped[5]!.themeName).toBe("FieldFlow");
    for (const read of reads) expect(read.filters).toContainEqual(["tenant_id", tenant]);
  });
  it("retains frozen frame background, focus and exact private signed paths", async () => {
    references.push({ version_id: version, role: "background", media_asset_id: bg, storage_bucket: "tenant-media", storage_path: bgPath, mime_type: "image/webp", checksum_sha256: "b".repeat(64) });
    const [item] = await mapContentLibraryRows(client(true), tenant, [row({ media_frame_id: frame, media_frame_version_id: version })]);
    expect(item).toMatchObject({ preview: null, mediaFramePreview: { settings: { appearance: { background: { kind: "image", mediaAssetId: bg, position: "right" } } }, sourceUrl: `https://storage.example.test/${mainPath}`, backgroundUrl: `https://storage.example.test/${bgPath}`, backgroundChecksumSha256: "b".repeat(64) } });
    expect(sign).toHaveBeenCalledExactlyOnceWith([mainPath, bgPath], 600);
  });
  it.each([`tenants/${id(99)}/assets/${asset}/foreign.webp`, `tenants/${tenant}/assets/${asset}/../other.webp`, `${mainPath}?secret=x`, `${mainPath}#fragment`, `${mainPath}\\bad`])("does not sign unsafe frozen source %s", async path => {
    references[0]!.storage_path = path;
    const [item] = await mapContentLibraryRows(client(), tenant, [row({ media_frame_id: frame, media_frame_version_id: version })]);
    expect(item!.mediaFramePreview).toBeUndefined(); expect(sign).not.toHaveBeenCalled();
  });
  it("does not replace missing frozen private background by current asset thumbnail", async () => {
    const [item] = await mapContentLibraryRows(client(true), tenant, [row({ preview_asset_id: asset, media_frame_id: frame, media_frame_version_id: version })]);
    expect(item!.preview).toBeNull(); expect(item!.mediaFramePreview).toBeUndefined();
  });
  it("keeps actual archive restore nonce and unbound original placement without writes", async () => {
    const [item] = await mapContentLibraryRows(null, tenant, [row({ archived: true, placement: { kind: "media", assetId: asset } })]);
    expect(item!.restoreKey).toMatch(/^[a-f0-9-]{36}$/); expect(item!.placement).toEqual({ kind: "media", assetId: asset }); expect(reads).toEqual([]);
  });
});
