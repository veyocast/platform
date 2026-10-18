import { describe, expect, it } from "vitest";
import { literalSponsorCrmSearch, parseSponsorCrmFilter, sponsorCrmHref } from "./sponsor-crm";

describe("Sponsor CRM read filters", () => {
  it("bounds user search/page values and only accepts known pipeline/task statuses", () => {
    expect(parseSponsorCrmFilter({ crmQuery: "  " + "a".repeat(130), crmStage: "published", crmStatus: "arbitrary", opportunityPage: "1.2", taskPage: "-2" })).toEqual({ query: "a".repeat(120), stage: "all", status: "all", opportunityPage: 1, taskPage: 1 });
    expect(parseSponsorCrmFilter({ crmStage: "proposal", crmStatus: "done", opportunityPage: "2", taskPage: "4" })).toMatchObject({ stage: "proposal", status: "done", opportunityPage: 2, taskPage: 4 });
  });
  it("retains both filtered lists while changing one page without injecting URL parameters", () => {
    const filter = parseSponsorCrmFilter({ crmQuery: "Club & taak#1", crmStage: "lead", crmStatus: "open", taskPage: "3" });
    const url = new URL(sponsorCrmHref(filter, { opportunityPage: 2 }), "https://control.example");
    expect(url.pathname).toBe("/dashboard/sponsors");
    expect(url.hash).toBe("#kansen");
    expect(Object.fromEntries(url.searchParams)).toEqual({ crm: "1", crmQuery: "Club & taak#1", crmStage: "lead", crmStatus: "open", opportunityPage: "2", taskPage: "3" });
  });
  it.each(["partner_50%", "a*b", "C:\\partner\\", "(a+)+$", "a.b|c?[d]{2}^", "café 🏟️"])('treats the full search "%s" as literal case-insensitive substring', value => {
    const pattern = new RegExp(literalSponsorCrmSearch(value), "iu");
    expect(pattern.test(`voor ${value} na`)).toBe(true);
    expect(pattern.test("onverwante partnernaam")).toBe(false);
  });
});
