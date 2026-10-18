import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaFrameDefaultSettings } from "@veyocast/contracts";
import type { MediaFrameSource } from "./media-frame-types";

const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), readSource: vi.fn(), sign: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("./media-frame-actions", () => ({ readMediaFrameSourceAction: f.readSource }));
import { loadMediaFrameEditor } from "./media-frame-data.server";

const tenant = "19170000-0000-4000-8000-000000000010";
const actor = "19170000-0000-4000-8000-000000000001";
const frameId = "19170000-0000-4000-8000-000000000101";
const mainId = "19170000-0000-4000-8000-000000000103";
const backgroundId = "19170000-0000-4000-8000-000000000104";
const versionId = "19170000-0000-4000-8000-000000000106";
const mainVariant = "19170000-0000-4000-8000-000000000105";
const frozenVariant = "19170000-0000-4000-8000-000000000108";
const currentVariant = "19170000-0000-4000-8000-000000000109";
const mainPath = `tenants/${tenant}/assets/${mainId}/original.webp`;
const backgroundPath = `tenants/${tenant}/assets/${backgroundId}/frozen.webp`;
const actorScope = `${tenant}:${actor}`;
type Row = Record<string, unknown>;
type DbResult = { data: Row[]; error: null };
type Read = { table: string; selection: string; filters: [string, unknown][]; limit: number | null };
let frame: Row | null;
let recent: string[];
let reads: Read[];
let refs: Row[];
let variants: Row[];

function source(mediaAssetId = mainId, role: "media" | "background" = "media"): MediaFrameSource {
  return { mediaAssetId, kind: "image", title: "Eigen foto", fileName: "foto.webp", width: 1920, height: 1080,
    byteSize: 1234, durationSeconds: null, sourceUrl: "https://storage.example.test/transient", posterUrl: null,
    expectedSource: { role, mediaAssetId, variantId: role === "media" ? mainVariant : currentVariant, checksumSha256: "a".repeat(64), byteSize: 1234 } };
}
function settings() {
  const settings = mediaFrameDefaultSettings(source());
  settings.appearance.background = { kind: "image", mediaAssetId: backgroundId, position: "right" };
  return settings;
}
class Query implements PromiseLike<DbResult> {
  readonly read: Read;
  constructor(table: string) { this.read = { table, selection: "", filters: [], limit: null }; reads.push(this.read); }
  select(value: string) { this.read.selection = value; return this; }
  eq(column: string, value: unknown) { this.read.filters.push([column, value]); return this; }
  in(column: string, value: unknown) { this.read.filters.push([column, value]); return this; }
  is(column: string, value: unknown) { this.read.filters.push([column, value]); return this; }
  order() { return this; }
  limit(value: number) { this.read.limit = value; return this; }
  async maybeSingle() { return { data: frame, error: null }; }
  result(): DbResult {
    if (this.read.table === "media_frame_versions") return { data: [{ id: versionId, version_number: 7, settings_json: settings(), created_at: "2026-10-18T12:00:00Z" }], error: null };
    if (this.read.table === "media_frame_version_assets") return { data: refs, error: null };
    if (this.read.table === "media_variants") return { data: variants, error: null };
    return { data: this.read.selection === "id" ? recent.map(id => ({ id })) : [mainId, backgroundId].map(id => ({ id, kind: "image", title: "Eigen foto", original_file_name: "foto.webp", duration_seconds: null })), error: null };
  }
  then<TResult1 = DbResult, TResult2 = never>(onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}
function expectScopedReads() {
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) expect(read.filters).toContainEqual(["tenant_id", tenant]);
  expect(reads.find(read => read.table === "media_assets" && read.selection === "id")?.limit).toBe(24);
  expect(reads.find(read => read.table === "media_frame_versions")?.limit).toBe(20);
}

beforeEach(() => {
  vi.resetAllMocks(); reads = []; recent = [];
  frame = { id: frameId, source_asset_id: mainId, is_primary: true, status: "active", revision: 7, current_version_id: versionId };
  refs = [
    { version_id: versionId, role: "media", media_asset_id: mainId, variant_id: mainVariant, checksum_sha256: "b".repeat(64), byte_size: 1234, storage_bucket: "tenant-media", storage_path: mainPath, mime_type: "image/webp", width: 1920, height: 1080, duration_seconds: null },
    { version_id: versionId, role: "background", media_asset_id: backgroundId, variant_id: frozenVariant, checksum_sha256: "c".repeat(64), byte_size: 4321, storage_bucket: "tenant-media", storage_path: backgroundPath, mime_type: "image/webp", width: 1920, height: 1080, duration_seconds: null },
  ];
  variants = refs.map(ref => ({ id: ref.variant_id, asset_id: ref.media_asset_id, checksum_sha256: ref.checksum_sha256, file_size_bytes: ref.byte_size, storage_bucket: ref.storage_bucket, storage_path: ref.storage_path, mime_type: ref.mime_type }));
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant, userId: actor, tenantStatus: "active", capabilities: ["tenant.media.read", "tenant.media.write"] });
  f.client.mockResolvedValue({ from: (table: string) => new Query(table), storage: { from: () => ({ createSignedUrl: f.sign }) } });
  f.sign.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://storage.example.test/${path}` }, error: null }));
  f.readSource.mockImplementation(async ({ mediaAssetId, role }: { mediaAssetId: string; role: "media" | "background" }) => ({ ok: true, source: source(mediaAssetId, role) }));
});

describe("Media-frame GET recovery admission and frozen backgrounds", () => {
  it.each([
    { status: "active", tenantStatus: "active", capabilities: ["tenant.media.read", "tenant.media.write"], canWrite: true, canReplayPending: true },
    { status: "archived", tenantStatus: "active", capabilities: ["tenant.media.read", "tenant.media.write"], canWrite: false, canReplayPending: true },
    { status: "archived", tenantStatus: "active", capabilities: ["tenant.media.read"], canWrite: false, canReplayPending: false },
    { status: "active", tenantStatus: "paused", capabilities: ["tenant.media.read", "tenant.media.write"], canWrite: false, canReplayPending: false },
  ])("separates new edits from exact pending replay for $status/$tenantStatus/$capabilities", async state => {
    frame!.status = state.status;
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, userId: actor, tenantStatus: state.tenantStatus, capabilities: state.capabilities });
    const result = await loadMediaFrameEditor({ frameId });
    expect(result).toMatchObject({ ok: true, archived: state.status === "archived", props: { canWrite: state.canWrite, canReplayPending: state.canReplayPending, actorScope } });
    expect(f.session).toHaveBeenCalledWith("tenant.media.read"); expectScopedReads();
  });

  it("includes the exact current background before all24 recent image choices", async () => {
    recent = Array.from({ length: 24 }, (_, index) => `19170000-0000-4000-8000-${String(index + 300).padStart(12, "0")}`);
    const result = await loadMediaFrameEditor({ frameId });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.props.imageSources).toHaveLength(25);
    expect(result.props.imageSources[0]).toMatchObject({ mediaAssetId: backgroundId, expectedSource: { variantId: frozenVariant, checksumSha256: "c".repeat(64), byteSize: 4321 } });
    expect(f.sign).toHaveBeenCalledWith(backgroundPath, 900);
    expect(f.readSource).toHaveBeenCalledTimes(24);
    for (const call of f.readSource.mock.calls) expect(call[1]).toBe(actorScope);
    expectScopedReads();
  });

  it("never substitutes today's preferred variant for the current frozen source", async () => {
    recent = [backgroundId];
    const result = await loadMediaFrameEditor({ frameId });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.props.imageSources).toHaveLength(1);
    expect(result.props.imageSources[0]?.expectedSource).toEqual({ role: "background", mediaAssetId: backgroundId, variantId: frozenVariant, checksumSha256: "c".repeat(64), byteSize: 4321 });
    expect(result.props.versions[0]?.sources[1]?.expectedSource).toEqual(result.props.imageSources[0]?.expectedSource);
    expect(f.readSource).toHaveBeenCalledWith({ tenantId: tenant, mediaAssetId: backgroundId, role: "background" }, actorScope);
  });

  it("fails closed when a frozen source no longer matches rather than using a recent replacement", async () => {
    recent = [backgroundId]; variants[1]!.checksum_sha256 = "a".repeat(64);
    expect(await loadMediaFrameEditor({ frameId })).toMatchObject({ ok: false, missing: false });
    expect(f.readSource).not.toHaveBeenCalled();
  });

  it("exposes the same fresh capability for an unsaved primary without making any writes", async () => {
    frame = null;
    const result = await loadMediaFrameEditor({ assetId: mainId });
    expect(result).toMatchObject({ ok: true, archived: false, props: { isNew: true, frameRevision: 0, canWrite: true, canReplayPending: true, actorScope } });
    expect(f.readSource).toHaveBeenCalledWith({ tenantId: tenant, mediaAssetId: mainId, role: "media" }, actorScope);
    expect(reads.map(read => read.table)).toEqual(["media_frames", "media_assets"]);
  });
});
