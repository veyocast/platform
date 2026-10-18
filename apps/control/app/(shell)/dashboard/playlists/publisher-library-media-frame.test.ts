import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";

const f = vi.hoisted(() => ({ rows: {} as Record<string, Array<Record<string, unknown>>>, rpcRows: [] as Array<Record<string, unknown>>, queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>, rpc: vi.fn(), sign: vi.fn() }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ storage: { from: () => ({ createSignedUrl: f.sign }) }, rpc: f.rpc, from: (table: string) => {
  const query = { table, filters: [] as Array<[string, unknown]> }; f.queries.push(query);
  const builder = { select: () => builder, eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; }, in: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; }, is: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; }, order: () => builder, limit: () => builder, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: f.rows[table] ?? [], error: null }).then(resolve) }; return builder;
} }) }));
import { loadPublisherLibrary } from "./library";
const id = (n: number) => `19170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(10), asset = id(30), primary = id(20), copy = id(21), variant = id(40), version = id(1), copyVersion = id(2), folder = id(50), collection = id(51);
const path = `tenants/${tenant}/assets/${asset}/immutable.mp4`;
beforeEach(() => {
  f.queries = []; f.rpc.mockReset().mockImplementation(async () => ({ data: f.rpcRows, error: null })); f.sign.mockReset().mockImplementation(async (source: string) => ({ data: { signedUrl: `https://private.example.test/${source}` }, error: null }));
  f.rpcRows = [{ asset_id: asset, source_asset_id: asset, media_frame_id: primary, media_frame_version_id: version, title: "Primair ontwerp", kind: "video", status: "ready", deleted_at: null, file_size_bytes: 1234, folder_id: folder, is_favorite: true, tags: [{ name: "Team" }], collections: [{ name: "Clubhuis" }], total_count: 97 }, { asset_id: copy, source_asset_id: asset, media_frame_id: copy, media_frame_version_id: copyVersion, title: "Eigen kopie", kind: "video", status: "ready", deleted_at: null, file_size_bytes: 1234, total_count: 97 }];
  f.rows = { media_folders: [{ id: folder, name: "Clubfoto’s" }], media_collections: [{ id: collection, name: "Clubhuis" }], media_frames: [{ id: primary, source_asset_id: asset, status: "active", current_version_id: version }, { id: copy, source_asset_id: asset, status: "active", current_version_id: copyVersion }], media_frame_versions: [version, copyVersion].map((versionId, index) => ({ id: versionId, frame_id: index ? copy : primary, version_number: index ? 4 : 1, settings_json: { ...mediaFrameDefaultSettings({ kind: "video", title: index ? "Eigen kopie" : "Primair ontwerp", durationSeconds: 901 }), fitMode: "contain", focus: "right" } })), media_frame_version_assets: [version, copyVersion].map(version_id => ({ version_id, role: "media", media_asset_id: asset, variant_id: variant, checksum_sha256: "a".repeat(64), byte_size: 1234, storage_bucket: "tenant-media", storage_path: path, mime_type: "video/mp4" })), media_assets: [{ id: asset, kind: "video", title: "Fysieke bron", file_size_bytes: 1234, status: "ready", deleted_at: null }], media_variants: [{ id: variant, asset_id: asset, variant_type: "player_1080p", duration_seconds: 901, checksum_sha256: "a".repeat(64), file_size_bytes: 1234, storage_bucket: "tenant-media", storage_path: path, mime_type: "video/mp4" }] };
});
describe("verified logical media library selection", () => {
  it("uses the unified server pagination/filter boundary and keeps primary/copy identities separate", async () => {
    const result = await loadPublisherLibrary(tenant, { tab: "media", query: "Eigen", offset: 48, folderId: folder, collectionId: collection, favorites: true });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("list_publisher_media_frame_library_v1", { p_tenant_id: tenant, p_page_size: 48, p_offset: 48, p_search: "Eigen", p_folder_id: folder, p_collection_id: collection, p_favorites_only: true });
    expect(result.total).toBe(97); expect(result.hasMore).toBe(true); expect(result.media).toHaveLength(2);
    expect(result.media[0]).toMatchObject({ id: asset, name: "Primair ontwerp", folder: "Clubfoto’s", favorite: true, tags: ["Team"], collections: ["Clubhuis"], durationSeconds: 901, mediaFrame: { frameId: primary, pinnedVersionId: version, selected: { mediaAssetId: asset }, fitMode: "contain", cropFocusX: 1, cropFocusY: 0.5, overrides: {} } });
    expect(result.media[1]).toMatchObject({ id: copy, name: "Eigen kopie", mediaFrame: { frameId: copy, pinnedVersionId: copyVersion, pinnedVersionNumber: 4, selected: { mediaAssetId: asset } } });
    expect(f.sign).toHaveBeenCalledExactlyOnceWith(path, 900);
    for (const query of f.queries.filter(query => query.table.startsWith("media_frame") || query.table === "media_variants")) expect(query.filters).toContainEqual(["tenant_id", tenant]);
  });
  it("retains the physical upload acknowledgement path without converting it into the primary frame", async () => {
    const result = await loadPublisherLibrary(tenant, { tab: "media", assetId: asset });
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.queries.find(query => query.table === "media_assets")!.filters).toContainEqual(["id", asset]); expect(f.queries.some(query => query.table.startsWith("media_frame"))).toBe(false);
    expect(result.media).toHaveLength(1); expect(result.media[0]).toMatchObject({ id: asset, name: "Fysieke bron", durationSeconds: 901 }); expect(result.media[0]!.mediaFrame).toBeUndefined(); expect(f.sign).toHaveBeenCalledExactlyOnceWith(path, 600);
  });
  it("does not infer frame binding for an unedited raw asset returned by the unified library", async () => {
    f.rpcRows = [{ asset_id: asset, title: "Onbewerkte bron", kind: "video", status: "ready", file_size_bytes: 1234, total_count: 1 }];
    const result = await loadPublisherLibrary(tenant, { tab: "media" }); expect(result.media[0]!.mediaFrame).toBeUndefined(); expect(f.queries.some(query => query.table.startsWith("media_frame"))).toBe(false);
  });
  it("fails closed when a frame changes after the library page was read", async () => {
    f.rows.media_frames![0]!.current_version_id = id(99); await expect(loadPublisherLibrary(tenant, { tab: "media" })).rejects.toThrow("intussen gewijzigd"); expect(f.sign).not.toHaveBeenCalled();
  });
  it("rejects a missing or non-ready immutable source instead of substituting a preferred variant", async () => {
    f.rows.media_assets![0]!.status = "processing"; await expect(loadPublisherLibrary(tenant, { tab: "media" })).rejects.toThrow("oorspronkelijke media-ontwerpversie"); expect(f.sign).not.toHaveBeenCalled();
  });
  it("validates both references before signing any of them", async () => {
    const background = id(31), backgroundVariant = id(41), foreign = `tenants/${id(99)}/assets/${background}/foreign.webp`;
    const settings = f.rows.media_frame_versions![0]!.settings_json as ReturnType<typeof mediaFrameDefaultSettings>; settings.appearance.background = { kind: "image", mediaAssetId: background, position: "center" };
    f.rows.media_frame_version_assets!.push({ version_id: version, role: "background", media_asset_id: background, variant_id: backgroundVariant, checksum_sha256: "b".repeat(64), byte_size: 1234, storage_bucket: "tenant-media", storage_path: foreign, mime_type: "image/webp" }); f.rows.media_assets!.push({ id: background, kind: "image", status: "ready", deleted_at: null }); f.rows.media_variants!.push({ id: backgroundVariant, asset_id: background, checksum_sha256: "b".repeat(64), file_size_bytes: 1234, storage_bucket: "tenant-media", storage_path: foreign, mime_type: "image/webp" });
    await expect(loadPublisherLibrary(tenant, { tab: "media" })).rejects.toThrow("oorspronkelijke media-ontwerpversie"); expect(f.sign).not.toHaveBeenCalled();
  });
});
