import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), asset: vi.fn(), usage: vi.fn(), rpc: vi.fn(), eq: vi.fn(), is: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantControlSession: f.auth }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
import { loadContentMediaArchivePreview } from "./content-resource-actions";
const assetId = "19170000-0000-4000-8000-000000000101", tenant = "19170000-0000-4000-8000-000000000010";
beforeEach(() => {
  vi.resetAllMocks();
  f.auth.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active" });
  f.asset.mockResolvedValue({ data: { id: assetId, title: "Eigen foto", kind: "image" }, error: null });
  f.usage.mockResolvedValue({ data: [], count: 0, error: null });
  const query = { select: vi.fn(), eq: f.eq, is: f.is, maybeSingle: f.asset };
  query.select.mockReturnValue(query); f.eq.mockReturnValue(query); f.is.mockReturnValue(query);
  f.rpc.mockReturnValue({ range: f.usage });
  f.client.mockResolvedValue({ from: vi.fn(() => query), rpc: f.rpc });
});
describe("Content archive impact read", () => {
  it("rejects malformed identifiers before session or database access", async () => {
    expect(await loadContentMediaArchivePreview("foreign;select")).toMatchObject({ ok: false });
    expect(f.auth).not.toHaveBeenCalled(); expect(f.client).not.toHaveBeenCalled();
  });
  it.each([null, "paused"])("requires an active authenticated tenant: %s", async status => {
    f.auth.mockResolvedValue({ isLive: true, tenantId: status ? tenant : null, tenantStatus: status });
    expect(await loadContentMediaArchivePreview(assetId)).toMatchObject({ ok: false }); expect(f.client).not.toHaveBeenCalled();
  });
  it("rechecks write capability and current tenant before reading exact usage", async () => {
    expect(await loadContentMediaArchivePreview(assetId)).toEqual({ ok: true, preview: { assetId, title: "Eigen foto", kind: "image", draftCount: 0, releaseCount: 0, screenCount: 0 } });
    expect(f.auth).toHaveBeenCalledWith("tenant.media.write");
    expect(f.eq.mock.calls).toEqual([["tenant_id", tenant], ["id", assetId]]); expect(f.is).toHaveBeenCalledWith("deleted_at", null);
    expect(f.rpc.mock.calls).toEqual([["get_media_asset_usage", { p_asset_id: assetId }, { count: "exact" }]]); expect(f.usage).toHaveBeenCalledWith(0, 999);
  });
  it("a foreign, archived or unreadable asset never reaches the impact RPC", async () => {
    f.asset.mockResolvedValue({ data: null, error: null });
    expect(await loadContentMediaArchivePreview(assetId)).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("counts distinct draft playlists, releases and screens without adding the two screen representations", async () => {
    f.usage.mockResolvedValue({ data: [{ usage_type: "draft", resource_id: "p1" }, { usage_type: "draft", resource_id: "p1" }, { usage_type: "release", resource_id: "r1", screen_count: 2 }, { usage_type: "screen", resource_id: "s1", screen_count: 1 }, { usage_type: "screen", resource_id: "s2", screen_count: 1 }], count: 5, error: null });
    expect(await loadContentMediaArchivePreview(assetId)).toMatchObject({ ok: true, preview: { draftCount: 1, releaseCount: 1, screenCount: 2 } });
  });
  it.each([
    { data: [], count: 1, error: null },
    { data: [], count: null, error: null },
    { data: [], count: 0, error: { code: "57014" } },
    { data: [{ usage_type: "unknown", resource_id: "p1" }], count: 1, error: null },
    { data: [{ usage_type: "draft", resource_id: null }], count: 1, error: null },
  ])("refuses incomplete, failed or malformed impact evidence", async response => {
    f.usage.mockResolvedValue(response);
    expect(await loadContentMediaArchivePreview(assetId)).toMatchObject({ ok: false });
  });
  it("a fresh permission rejection cannot produce an archive preview", async () => {
    f.auth.mockRejectedValue(new Error("denied"));
    await expect(loadContentMediaArchivePreview(assetId)).rejects.toThrow("denied"); expect(f.client).not.toHaveBeenCalled();
  });
});
