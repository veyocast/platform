import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), load: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ getControlSession: f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
vi.mock("../../../../(shell)/dashboard/integrations/twelve-products/data", () => ({ loadProductImport: f.load }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
import { POST } from "./route";
const id = "a1910000-0000-4000-8000-000000006952", tenant = "a1910000-0000-4000-8000-000000006951";
const context = { params: Promise.resolve({ importId: id }) };
const draft = { status: "draft", fileName: "export.csv", headers: ["Artikel", "Prijs"], rows: [{ source: { Artikel: "Koffie", Prijs: "2,35" } }] };
function request(values: Record<string, string> = {}, origin = "https://control.veyocast.nl") {
  return new Request(`https://control.veyocast.nl/api/products/import/${id}`, { method: "POST", headers: { origin, host: "control.veyocast.nl", "content-length": "200" }, body: new URLSearchParams({ importId: id, intent: "mapping", "target-0": "name", "target-1": "price", ...values }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.product.write"] });
  f.load.mockResolvedValue(draft); f.rpc.mockResolvedValue({ error: null });
});
it("rejects foreign, opaque and downgraded Origins before session or parsing", async () => {
  for (const origin of ["https://other.invalid", "null", "bad", "http://control.veyocast.nl"]) expect((await POST(request({}, origin), context)).status).toBe(403);
  expect(f.session).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
});
it("enforces live write capability and active tenant before loading an import", async () => {
  for (const change of [{ capabilities: [] }, { tenantId: null }, { tenantStatus: "paused" }, { isLive: false }]) {
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.product.write"], ...change });
    expect((await POST(request(), context)).status).toBe(403);
  }
  expect(f.load).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
});
it("loads only the current tenant and rejects absent/cross-tenant imports without a write", async () => {
  f.load.mockResolvedValue(null);
  expect((await POST(request(), context)).status).toBe(404);
  expect(f.load).toHaveBeenCalledExactlyOnceWith(tenant, id); expect(f.rpc).not.toHaveBeenCalled();
});
it("normalizes actual stored rows and returns a normal303 only after the guarded mapping receipt", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(303); expect(response.headers.get("location")).toBe(`https://control.veyocast.nl/dashboard/sources/twelve/imports/${id}?succes=mapping`);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("replace_product_import_rows_v1", expect.objectContaining({ p_import_id: id, p_column_mapping: { Artikel: "name", Prijs: "price" }, p_rows: [expect.objectContaining({ normalized: expect.objectContaining({ name: "Koffie", price_cents: 235 }) })] }));
});
it("a failed mapping never reports success or applies the catalog", async () => {
  f.rpc.mockResolvedValue({ error: { code: "42501" } });
  expect((await POST(request(), context)).headers.get("location")).toContain("?fout=mapping");
  expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.revalidate).not.toHaveBeenCalled();
});
it("applies through the existing RPC and recovers an already applied immutable import without a duplicate", async () => {
  const response = await POST(request({ intent: "apply", mode: "merge" }), context);
  expect(response.status).toBe(303); expect(response.headers.get("location")).toContain("/products?succes=geimporteerd");
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("apply_product_import_v1", { p_import_id: id, p_mode: "merge" });
  f.rpc.mockClear(); f.load.mockResolvedValue({ ...draft, status: "applied" });
  expect((await POST(request({ intent: "apply", mode: "merge" }), context)).headers.get("location")).toContain("succes=geimporteerd");
  expect(f.rpc).not.toHaveBeenCalled();
});
it("verifies a concurrent apply receipt after an uncertain error and rejects a mismatched form identity", async () => {
  f.rpc.mockResolvedValue({ error: { code: "23514" } });
  f.load.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, status: "applied" });
  expect((await POST(request({ intent: "apply", mode: "merge" }), context)).headers.get("location")).toContain("succes=geimporteerd");
  f.rpc.mockClear(); expect((await POST(request({ importId: tenant }), context)).status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
});
