import type * as Integrations from "@veyocast/integrations";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), workbook: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ getControlSession: f.session }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
vi.mock("@veyocast/integrations", async original => ({ ...await original<typeof Integrations>(), parseProductWorkbook: f.workbook }));
import { POST } from "./route";
const tenant = "a1910000-0000-4000-8000-000000006951", id = "a1910000-0000-4000-8000-000000006952";
function request(name: string, contents: string, type = "text/csv") { const form = new FormData(); form.set("file", new File([contents], name, { type })); return new Request("http://127.0.0.1/api/products/import", { method: "POST", headers: { "content-length": "1000" }, body: form }); }
beforeEach(() => { vi.resetAllMocks(); f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.product.write"] }); f.rpc.mockResolvedValue({ data: id, error: null }); });
describe("Echte CSV-upload bereidt uitsluitend een tenant-scoped review voor", () => {
  it("staged UTF-8 CSV met exact integergeld, werkelijk bestand/hash/bronwaarden zonder apply", async () => {
    const response = await POST(request("export.csv", "naam;prijs;artikelnummer\nKoffie;2,35;0123"));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ importId: id, rowCount: 1 });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("stage_product_import_v1", expect.objectContaining({ p_tenant_id: tenant, p_file_name: "export.csv", p_file_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u), p_sheet_name: "CSV", p_rows: [expect.objectContaining({ source: { naam: "Koffie", prijs: "2,35", artikelnummer: "0123" }, normalized: expect.objectContaining({ price_cents: 235, external_id: "0123" }) })] }));
    expect(f.workbook).not.toHaveBeenCalled();
  });
  it("houdt xlsx in de bestaande parser en daadwerkelijke reviewketen", async () => {
    f.workbook.mockResolvedValue({ fileName: "x.xlsx", sheetName: "Producten", headers: ["naam", "prijs"], rows: [{ naam: "Koffie", prijs: 2.35 }] });
    expect((await POST(request("x.xlsx", "PK-test", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))).status).toBe(200); expect(f.workbook).toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("weigert onjuist MIME en malformed CSV zonder gedeeltelijke review of cataloguswrites", async () => {
    expect((await POST(request("x.csv", "naam;prijs\nA;2", "application/pdf"))).status).toBe(400);
    expect((await POST(request("x.csv", 'naam;prijs\n"A;2'))).status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("handhaaft schrijfrol en actieve tenant vóór bestandverwerking", async () => {
    for (const overrides of [{ capabilities: [] }, { tenantStatus: "paused" }, { tenantId: null }]) { f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.product.write"], ...overrides }); expect((await POST(request("x.csv", "naam;prijs\nA;2"))).status).toBe(403); }
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.workbook).not.toHaveBeenCalled();
  });
});
