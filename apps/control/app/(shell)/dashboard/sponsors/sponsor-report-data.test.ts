import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../../../tests/fixtures/s299-sponsor-report.json";
import { loadSponsorReport } from "./sponsor-report-data";
import { parseSponsorReportFilter } from "./sponsor-report";

const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => boundary.client }));
describe("authenticated full sponsor report read", () => {
  let result: unknown, fail = false;
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const filter = () => parseSponsorReportFilter({ reportFrom: "2026-11-01", reportUntil: "2026-11-10", reportAsOf: fixture.asOf }, "Europe/Amsterdam", new Date("2026-11-09T10:00:00Z")).filter;
  beforeEach(() => {
    result = fixture; fail = false; requests.length = 0;
    boundary.client = createClient("http://127.0.0.1:51999", "controlled-test-anon", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json(fail ? { message: "denied", code: "42501" } : result, { status: fail ? 403 : 200 });
    } } });
  });
  it("uses one RPC for complete totals, bounded rows and identical export filters", async () => {
    const read = await loadSponsorReport("own-tenant", filter());
    expect(read.error).toBe(false);
    expect(read.report?.totals.acceptedEvents).toBe("5501");
    expect(read.report?.details).toHaveLength(50);
    expect(requests).toEqual([{ url: "http://127.0.0.1:51999/rest/v1/rpc/get_sponsor_report_v1", body: { p_tenant_id: "own-tenant", p_from_date: "2026-11-01", p_until_date: "2026-11-10", p_campaign_id: null, p_screen_id: null, p_as_of: fixture.asOf, p_before_happened_at: null, p_before_event_id: null, p_detail_limit: 50 } }]);
  });
  it.each(["failed", "malformed", "wrong-scope"])("fails visibly on %s without substituting detail-row totals", async mode => {
    if (mode === "failed") fail = true;
    if (mode === "malformed") result = { ...fixture, totals: { acceptedEvents: 50, playedMs: "0" } };
    if (mode === "wrong-scope") result = { ...fixture, filters: { campaignId: fixture.filterOptions.campaigns[0]!.id, screenId: null } };
    expect(await loadSponsorReport("own-tenant", filter())).toEqual({ report: null, error: true });
  });
  it("does not query without an explicit tenant or configured user client", async () => {
    expect((await loadSponsorReport("", filter())).error).toBe(true);
    boundary.client = null;
    expect((await loadSponsorReport("own-tenant", filter())).error).toBe(true);
    expect(requests).toHaveLength(0);
  });
});
