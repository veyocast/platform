import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ capability: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), client: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: f.client }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
import { saveSitesMediaMetadata } from "./sites-media-metadata-actions";

const tenant = "19170000-0000-4000-8000-000000000010", asset = "19170000-0000-4000-8000-000000000080", folder = "19170000-0000-4000-8000-000000000081", key = "19170000-0000-4000-8000-000000000082", timestamp = "2026-10-11T10:00:00.000Z";
function form() { const form = new FormData(); for (const [name, value] of Object.entries({ assetId: asset, idempotencyKey: key, expectedUpdatedAt: timestamp, title: " Clubbeeld ", folderId: folder, tags: "jeugd, zomer,jeugd", collections: "Wedstrijddag, Seizoensopening", favorite: "on" })) form.set(name, value); return form; }
beforeEach(() => { vi.clearAllMocks(); f.capability.mockResolvedValue({ tenantId: tenant, isLive: true }); f.client.mockResolvedValue({ rpc: f.rpc }); f.rpc.mockResolvedValue({ error: null, data: { outcome: "applied", assetId: asset, actualUpdatedAt: "2026-10-11T10:01:00.000Z" } }); });
describe("Media metadata gebruikt één echte tenant/CAS-opdracht", () => {
  it("gebruikt de actieve vereniging en oorspronkelijke timestamp zonder bytes of releases te wijzigen", async () => {
    expect(await saveSitesMediaMetadata(form())).toMatchObject({ status: "saved", actualUpdatedAt: "2026-10-11T10:01:00.000Z" });
    expect(f.capability).toHaveBeenCalledWith("tenant.media.write");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("save_media_metadata_v1", { p_tenant_id: tenant, p_asset_id: asset, p_expected_updated_at: timestamp, p_idempotency_key: key, p_payload: { title: "Clubbeeld", folderId: folder, tags: ["jeugd", "zomer"], collections: ["Wedstrijddag", "Seizoensopening"], favorite: true } });
    expect(f.revalidate).toHaveBeenCalledExactlyOnceWith("/dashboard/media");
  });
  it("negeert browser-tenantvelden en behoudt de vaste command-ID bij onbekende netwerkuitkomst", async () => {
    const data = form(); data.set("tenantId", "19170000-0000-4000-8000-000000000011"); f.rpc.mockRejectedValueOnce(new Error("private secret"));
    expect(await saveSitesMediaMetadata(data)).toMatchObject({ status: "error", message: expect.stringContaining("invoer blijft behouden") });
    expect((await saveSitesMediaMetadata(data)).status).toBe("saved"); expect(f.rpc.mock.calls.map(call => call[1].p_tenant_id)).toEqual([tenant, tenant]); expect(f.rpc.mock.calls.map(call => call[1].p_idempotency_key)).toEqual([key, key]);
  });
  it("meldt een CAS-conflict zonder redirect of succes/revalidatie", async () => { f.rpc.mockResolvedValue({ error: null, data: { outcome: "conflict", assetId: asset, actualUpdatedAt: "2026-10-11T10:02:00Z" } }); expect(await saveSitesMediaMetadata(form())).toMatchObject({ status: "conflict", message: expect.stringContaining("invoer blijft behouden") }); expect(f.revalidate).not.toHaveBeenCalled(); });
  it("weigert ontbrekende rechten en een ontbrekende live sessie vóór enige RPC", async () => { f.capability.mockRejectedValueOnce(new Error("forbidden")); await expect(saveSitesMediaMetadata(form())).rejects.toThrow("forbidden"); f.capability.mockResolvedValue({ tenantId: tenant, isLive: false }); expect((await saveSitesMediaMetadata(form())).status).toBe("error"); expect(f.rpc).not.toHaveBeenCalled(); });
  it.each([{ outcome: "applied", assetId: "wrong", actualUpdatedAt: timestamp }, { outcome: "applied", assetId: asset }, { outcome: "created", assetId: asset, actualUpdatedAt: timestamp }, { outcome: "applied", assetId: asset, actualUpdatedAt: "not-a-date" }])("claimt geen succes bij onvolledige of verkeerde receipts", async data => { f.rpc.mockResolvedValue({ data, error: null }); expect((await saveSitesMediaMetadata(form())).status).toBe("error"); expect(f.revalidate).not.toHaveBeenCalled(); });
  it("valideert de werkelijke tag/collectiebounds en timestamp zonder databasecall", async () => {
    for (const [name, value] of [["tags", "x".repeat(49)], ["collections", "x"], ["collections", "x".repeat(81)], ["tags", Array.from({ length: 21 }, (_, index) => `tag${index}`).join(",")], ["idempotencyKey", "forged"], ["expectedUpdatedAt", "11 oktober 2026"], ["title", "x"]]) { const data = form(); data.set(name!, value!); expect((await saveSitesMediaMetadata(data)).status).toBe("error"); }
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.capability).not.toHaveBeenCalled();
  });
  it("geeft geen ruwe serverfout door en claimt geen succes bij serverweigering", async () => { f.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "sensitive provider/member payload" } }); const result = await saveSitesMediaMetadata(form()); expect(result.status).toBe("error"); expect(result.message).not.toContain("sensitive"); expect(f.revalidate).not.toHaveBeenCalled(); });
});
