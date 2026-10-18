import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSponsorCrm } from "./sponsor-crm-data";
import { parseSponsorCrmFilter } from "./sponsor-crm";

const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => boundary.client }));

describe("Sponsor CRM authenticated read boundary", () => {
  const requests: URL[] = [];
  let fail = false;
  beforeEach(() => {
    requests.length = 0;
    fail = false;
    boundary.client = createClient("http://127.0.0.1:51999", "controlled-test-anon", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async input => {
        const url = new URL(String(input));
        requests.push(url);
        const opportunity = url.pathname.endsWith("sponsor_opportunities");
        return new Response(JSON.stringify(fail ? { code: "42501", message: "Denied" } : opportunity ? [{ id: "own-opportunity", name: "Partner", stage: "proposal", estimated_value_cents: 19900, next_action_at: null }] : []), { status: fail ? 403 : 200, headers: { "content-type": "application/json", "content-range": opportunity ? "25-25/26" : "*/0" } });
      } }
    });
  });
  it("sends tenant and literal search boundaries on both independently paginated reads", async () => {
    const data = await loadSponsorCrm("own-tenant", parseSponsorCrmFilter({ crmQuery: "Club_50%*", crmStage: "proposal", crmStatus: "open", opportunityPage: "2" }));
    expect(data).toMatchObject({ error: false, opportunityCount: 26, taskCount: 0 });
    expect(data.opportunities[0]?.name).toBe("Partner");
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.searchParams.get("tenant_id")).toBe("eq.own-tenant");
      expect(request.searchParams.get("limit")).toBe("25");
    }
    expect(requests[0]?.searchParams.get("name")).toBe("imatch.Club_50%\\*");
    expect(requests[0]?.searchParams.get("stage")).toBe("eq.proposal");
    expect(requests[0]?.searchParams.get("offset")).toBe("25");
    expect(requests[1]?.searchParams.get("status")).toBe("eq.open");
    expect(requests[1]?.searchParams.get("offset")).toBe("0");
  });
  it("fails visibly without returning a partially successful list", async () => {
    fail = true;
    expect(await loadSponsorCrm("own-tenant", parseSponsorCrmFilter({}))).toEqual({ error: true, opportunities: [], opportunityCount: 0, tasks: [], taskCount: 0 });
  });
  it("does not query without an explicit tenant or an authenticated client", async () => {
    expect((await loadSponsorCrm("", parseSponsorCrmFilter({}))).error).toBe(true);
    boundary.client = null;
    expect((await loadSponsorCrm("own-tenant", parseSponsorCrmFilter({}))).error).toBe(true);
    expect(requests).toHaveLength(0);
  });
});
