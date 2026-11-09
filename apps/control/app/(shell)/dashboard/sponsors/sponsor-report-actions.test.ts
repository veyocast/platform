import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSponsorReportGoal } from "./actions";
const f = vi.hoisted(() => ({ capability: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { f.redirect(url); throw new Error("redirect"); } }));
const tenant = "29900000-0000-4000-8000-000000000020", campaign = "29900000-0000-4000-8000-000000000001";
function form(target = "6500") { const data = new FormData(); for (const [key, value] of Object.entries({ reportCampaign: campaign, reportScreen: "", reportFrom: "2026-11-01", reportUntil: "2026-11-10", targetPlays: target })) data.set(key, value); return data; }
describe("explicit campaign-period sponsor agreement command", () => {
  beforeEach(() => { vi.clearAllMocks(); f.capability.mockResolvedValue({ tenantId: tenant, tenantStatus: "active", timezoneName: "Europe/Amsterdam" }); f.rpc.mockResolvedValue({ error: null }); });
  it.each([["6500", "6500"], ["0", "0"], ["", null]])("writes explicit %j target independently of campaign rotation", async (input, expected) => {
    await expect(setSponsorReportGoal(form(input!))).rejects.toThrow("redirect");
    expect(f.capability).toHaveBeenCalledExactlyOnceWith("tenant.sponsor.write");
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("set_sponsor_report_goal_v1", { p_tenant_id: tenant, p_campaign_id: campaign, p_from_date: "2026-11-01", p_until_date: "2026-11-10", p_target_plays: expected });
    expect(f.revalidate).toHaveBeenCalledWith("/dashboard/sponsors");
    expect(f.redirect.mock.calls[0]?.[0]).toContain("reportFrom=2026-11-01&reportUntil=2026-11-10");
  });
  it.each(["-1", "1.5", "1e3", "=1", "9007199254740992"])("rejects invalid target %s without a command", async target => {
    await expect(setSponsorReportGoal(form(target))).rejects.toThrow("redirect");
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.redirect).toHaveBeenCalledWith("/dashboard/sponsors?fout=afspraak");
  });
  it("uses the existing capability guard and active tenant before writes", async () => {
    f.capability.mockRejectedValueOnce(new Error("denied"));
    await expect(setSponsorReportGoal(form())).rejects.toThrow("denied");
    f.capability.mockResolvedValueOnce({ tenantId: tenant, tenantStatus: "paused", timezoneName: "Europe/Amsterdam" });
    await expect(setSponsorReportGoal(form())).rejects.toThrow("redirect");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("never confirms a failed database write", async () => {
    f.rpc.mockResolvedValue({ error: { code: "42501" } });
    await expect(setSponsorReportGoal(form())).rejects.toThrow("redirect");
    expect(f.revalidate).not.toHaveBeenCalled();
    expect(f.redirect).toHaveBeenCalledWith("/dashboard/sponsors?fout=afspraak");
  });
});
