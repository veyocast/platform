import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ session: { isLive: true, tenantId: "19170000-0000-4000-8000-000000000010", tenantStatus: "active", assuranceLevel: "aal2", capabilities: ["tenant.sponsor.approve"] }, rpc: vi.fn(), invalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ getControlSession: async () => f.session }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.invalidate }));
import { POST } from "./route";
const id = "19170000-0000-4000-8000-000000000901";
function request(origin = "https://control.example", campaignId = id) {
  const body = new URLSearchParams({ campaignId }).toString();
  return new Request("https://control.example/api/sponsors/campaigns/approve", { method: "POST", headers: { origin, host: "control.example", "content-type": "application/x-www-form-urlencoded", "content-length": String(body.length) }, body });
}
beforeEach(() => { f.session.assuranceLevel = "aal2"; f.session.tenantStatus = "active"; f.session.capabilities = ["tenant.sponsor.approve"]; f.rpc.mockReset().mockResolvedValue({ data: null, error: null }); f.invalidate.mockClear(); });
it("rejects cross-origin, inactive tenant and missing approval rights before the writer", async () => {
  expect((await POST(request("https://foreign.example"))).status).toBe(403);
  f.session.tenantStatus = "paused"; expect((await POST(request())).status).toBe(403);
  f.session.tenantStatus = "active"; f.session.capabilities = []; expect((await POST(request())).status).toBe(403);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("keeps the exact authenticated tenant command and returns a GET redirect after success", async () => {
  const response = await POST(request());
  expect(f.rpc).toHaveBeenCalledWith("approve_sponsor_campaign_v1", { p_tenant_id: f.session.tenantId, p_campaign_id: id, p_approve: true });
  expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://control.example/dashboard/sponsors?succes=goedgekeurd");
  expect(f.invalidate).toHaveBeenCalledWith("/dashboard/sponsors");
});
it("makes the database four-eyes refusal a real browser navigation to the existing error banner", async () => {
  f.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  const response = await POST(request());
  expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://control.example/dashboard/sponsors?fout=campagneactie");
  expect(f.invalidate).not.toHaveBeenCalled();
});
it("rejects malformed campaign identity before contacting the writer", async () => {
  expect((await POST(request("https://control.example", "invalid"))).status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
});

it("preserves the existing sponsor assurance policy and leaves final authorization to its guarded RPC", async () => {
  f.session.assuranceLevel = "aal1";
  expect((await POST(request())).status).toBe(303);
  expect(f.rpc).toHaveBeenCalledTimes(1);
});

it("keeps browser host-only cookies when Next uses a different local listen hostname", async () => {
  const body = new URLSearchParams({ campaignId: id }).toString();
  const actual = new Request("http://127.0.0.1:3250/api/sponsors/campaigns/approve", { method: "POST", headers: { origin: "http://localhost:3250", host: "localhost:3250", "content-type": "application/x-www-form-urlencoded", "content-length": String(body.length) }, body });
  f.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  const response = await POST(actual);
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:3250/dashboard/sponsors?fout=campagneactie");
});
