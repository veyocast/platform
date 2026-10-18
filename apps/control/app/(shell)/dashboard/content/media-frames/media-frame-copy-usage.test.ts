import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), client: vi.fn(), rpc: vi.fn(), sign: vi.fn(), range: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { mutateMediaFrameAction, prepareMediaFrameCopyAction, readMediaFrameUsageAction } from "./media-frame-actions";
const tenant = "19170000-0000-4000-8000-000000000010", actor = "19170000-0000-4000-8000-000000000001", asset = "19170000-0000-4000-8000-000000000123", frame = "19170000-0000-4000-8000-000000000124", scope = `${tenant}:${actor}`;
beforeEach(() => {
  vi.resetAllMocks();
  f.session.mockResolvedValue({ isLive: true, userId: actor, tenantId: tenant, tenantStatus: "active" });
  f.client.mockResolvedValue({ rpc: f.rpc, storage: { from: () => ({ createSignedUrl: f.sign }) } });
  f.sign.mockResolvedValue({ data: { signedUrl: "https://private.test/ephemeral" }, error: null });
  f.rpc.mockResolvedValue({ data: { mediaAssetId: asset, kind: "video", title: "Lange eigen video", fileName: "bron.mp4", width: 1920, height: 1080, durationSeconds: 241, maximumDurationSeconds: 241,
    variant: { variantId: frame, checksumSha256: "a".repeat(64), byteSize: 1234, storageBucket: "tenant-media", storagePath: `tenants/${tenant}/assets/${asset}/verified.mp4`, mimeType: "video/mp4" }, poster: null }, error: null });
});
describe("explicit media-frame copy preparation and complete usage", () => {
  it("prepares a separate copy without performing a create or truncating the verified video duration", async () => {
    const result = await prepareMediaFrameCopyAction({ tenantId: tenant, mediaAssetId: asset }, scope);
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.message);
    expect(f.session.mock.calls).toEqual([["tenant.media.write"], ["tenant.media.read"]]);
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(["get_media_frame_source_v1"]);
    expect(result.command).toMatchObject({ operation: "create", expectedRevision: 0, isPrimary: false, sourceAssetId: asset, settings: { durationSeconds: 241, name: "Lange eigen video (kopie)" } });
    expect(result.command.frameId).not.toBe(asset); expect(JSON.stringify(result.command)).not.toContain("https:");
    f.rpc.mockResolvedValue({ data: { frameId: result.command.frameId, frameRevision: 1, versionId: frame, versionNumber: 1, outcome: "created" }, error: null });
    expect((await mutateMediaFrameAction(result.command, scope)).ok).toBe(true);
    expect(f.rpc.mock.calls.at(-1)).toEqual(["create_media_frame_v1", { p_tenant_id: tenant, p_frame_id: result.command.frameId, p_source_asset_id: asset, p_expected_sources: result.command.expectedSources, p_settings: result.command.settings, p_idempotency_key: result.command.idempotencyKey, p_is_primary: false }]);
  });
  it.each([undefined, `${tenant}:another-actor`, "another-tenant:actor"])("refuses stale copy/usage scope %s before creating a client", async stale => {
    expect(await prepareMediaFrameCopyAction({ tenantId: tenant, mediaAssetId: asset }, stale as string)).toMatchObject({ ok: false });
    expect(await readMediaFrameUsageAction({ tenantId: tenant, frameId: frame }, stale as string)).toMatchObject({ ok: false });
    expect(f.client).not.toHaveBeenCalled();
  });
  it.each([{ data: [], count: null }, { data: [], count: 2 }, { data: [{ usage_type: "unknown", resource_id: frame }], count: 1 }, { data: [{ usage_type: "draft" }], count: 1 }])("fails closed on incomplete or malformed usage %j", async value => {
    f.rpc.mockReturnValue({ range: f.range }); f.range.mockResolvedValue({ ...value, error: null });
    expect(await readMediaFrameUsageAction({ tenantId: tenant, frameId: frame }, scope)).toMatchObject({ ok: false });
    expect(f.rpc.mock.calls).toEqual([["get_media_frame_usage_v1", { p_tenant_id: tenant, p_frame_id: frame }, { count: "exact" }]]);
    expect(f.range).toHaveBeenCalledWith(0, 999);
  });
  it("counts exact distinct frame usage without doubling release screen summaries", async () => {
    f.rpc.mockReturnValue({ range: f.range });
    f.range.mockResolvedValue({ data: [{ usage_type: "draft", resource_id: "p1" }, { usage_type: "draft", resource_id: "p1" }, { usage_type: "release", resource_id: "r1", screen_count: 2 }, { usage_type: "screen", resource_id: "s1" }, { usage_type: "screen", resource_id: "s2" }], count: 5, error: null });
    expect(await readMediaFrameUsageAction({ tenantId: tenant, frameId: frame }, scope)).toEqual({ ok: true, draftCount: 1, releaseCount: 1, screenCount: 2 });
  });
});
