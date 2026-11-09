import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../../../../tests/fixtures/s299-sponsor-report.json";
import { sponsorReportSchema } from "@veyocast/contracts";
import { GET } from "./route";

const f = vi.hoisted(() => ({ session: vi.fn(), report: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ getControlSession: f.session }));
vi.mock("../../../../(shell)/dashboard/sponsors/sponsor-report-data", () => ({ loadSponsorReport: f.report }));
const tenant = "29900000-0000-4000-8000-000000000020";
const query = new URLSearchParams({ reportFrom: fixture.period.fromDate, reportUntil: fixture.period.untilDate, reportAsOf: fixture.asOf });
describe("Sponsor report CSV authenticated boundary", () => {
  beforeEach(() => {
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "active", timezoneName: "Europe/Amsterdam", capabilities: ["tenant.sponsor.read", "tenant.sponsor.report"] });
    f.report.mockReset().mockResolvedValue({ report: sponsorReportSchema.parse(fixture), error: false });
  });
  it("exports complete totals and the same fixed cut, with private download headers", async () => {
    const response = await GET(new Request(`http://127.0.0.1/api/sponsors/report/export?${query}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("sponsorrapport-2026-11-01-2026-11-10.csv");
    expect(await response.text()).toContain('"Totaal";"";"";"5501";"5509251"');
    expect(f.report).toHaveBeenCalledExactlyOnceWith(tenant, expect.objectContaining({ fromDate: "2026-11-01", untilDate: "2026-11-10", asOf: fixture.asOf, campaignId: null, screenId: null }));
  });
  it.each([null, { isLive: false }, { tenantId: null }, { tenantStatus: "archived" }, { capabilities: ["tenant.sponsor.read"] }, { capabilities: ["tenant.sponsor.report"] }])("rejects absent or unauthorized session %j before data access", async overrides => {
    f.session.mockResolvedValue(overrides === null ? null : { isLive: true, tenantId: tenant, tenantStatus: "active", capabilities: ["tenant.sponsor.read", "tenant.sponsor.report"], ...overrides });
    expect((await GET(new Request(`http://127.0.0.1/api/sponsors/report/export?${query}`))).status).toBe(403);
    expect(f.report).not.toHaveBeenCalled();
  });
  it.each(["reportCampaign=other", "reportFrom=2026-02-30", "reportScreen=other", "reportBeforeId=29900000-0000-4000-8000-000000000001", "reportFrom=2026-11-01&reportFrom=2026-11-02"])("rejects malformed filters %s rather than exporting a broader scope", async values => {
    expect((await GET(new Request(`http://127.0.0.1/api/sponsors/report/export?reportAsOf=${encodeURIComponent(fixture.asOf)}&${values}`))).status).toBe(400);
    expect(f.report).not.toHaveBeenCalled();
  });
  it("requires a reproducible receipt cutoff and surfaces failed reads without CSV data", async () => {
    expect((await GET(new Request("http://127.0.0.1/api/sponsors/report/export?reportFrom=2026-11-01&reportUntil=2026-11-10"))).status).toBe(400);
    f.report.mockResolvedValue({ report: null, error: true });
    const response = await GET(new Request(`http://127.0.0.1/api/sponsors/report/export?${query}&tenantId=foreign-tenant`));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("5501");
    expect(f.report).toHaveBeenCalledExactlyOnceWith(tenant, expect.anything());
  });
  it("permits read-only export for a paused tenant using its existing capability", async () => {
    f.session.mockResolvedValue({ isLive: true, tenantId: tenant, tenantStatus: "paused", timezoneName: "Europe/Amsterdam", capabilities: ["tenant.sponsor.read", "tenant.sponsor.report"] });
    expect((await GET(new Request(`http://127.0.0.1/api/sponsors/report/export?${query}`))).status).toBe(200);
  });
});
