import { describe, expect, it } from "vitest";
import { sponsorReportSchema } from "@veyocast/contracts";
import fixture from "../../../../../../tests/fixtures/s299-sponsor-report.json";
import { formatSponsorCount, formatSponsorDuration, parseSponsorReportFilter, sponsorCsvCell, sponsorReportCsv, sponsorReportQuery } from "./sponsor-report";

const now = new Date("2026-11-09T10:00:00Z");
describe("complete Sponsor Hub report filters and safe CSV", () => {
  it("defaults to 30 complete local calendar dates, independent of UTC midnight", () => {
    const result = parseSponsorReportFilter({}, "Europe/Amsterdam", new Date("2026-10-25T23:30:00Z"));
    expect(result).toMatchObject({ invalid: false, filter: { fromDate: "2026-09-27", untilDate: "2026-10-27", asOf: null } });
  });
  it.each([
    { reportFrom: "2026-02-30" }, { reportUntil: "2026-10-01" }, { reportCampaign: "other-tenant" }, { reportScreen: "not-a-uuid" },
    { reportFrom: ["2026-11-01", "2026-11-02"] }, { reportAsOf: "infinity" }, { reportAsOf: "2026-11-09T10:02:00Z" },
    { reportBeforeAt: "2026-11-08T10:00:00Z" }, { reportFrom: "2000-01-01", reportUntil: "2026-11-10" }
  ])("fails closed for invalid or ambiguous filters %j", params => {
    expect(parseSponsorReportFilter(params, "Europe/Amsterdam", now).invalid).toBe(true);
  });
  it("round-trips the exact cutoff and both cursor coordinates without altering filters", () => {
    const { filter, invalid } = parseSponsorReportFilter({ reportCampaign: fixture.filterOptions.campaigns[0]!.id, reportScreen: fixture.filterOptions.screens[0]!.id, reportFrom: "2026-11-01", reportUntil: "2026-11-10" }, "Europe/Amsterdam", now);
    expect(invalid).toBe(false);
    const query = sponsorReportQuery(filter, fixture.asOf, fixture.details[49]);
    const again = parseSponsorReportFilter(Object.fromEntries(new URLSearchParams(query)), "Europe/Amsterdam", now);
    expect(again).toMatchObject({ invalid: false, filter: { ...filter, asOf: fixture.asOf, beforeAt: fixture.details[49]!.happenedAt, beforeId: fixture.details[49]!.eventId } });
    expect(new URLSearchParams(sponsorReportQuery(again.filter, fixture.asOf)).has("reportBeforeId")).toBe(false);
  });
  it("keeps bigint totals exact, independently of the 50 details", () => {
    expect(formatSponsorCount("9007199254740991000")).toBe("9.007.199.254.740.991.000");
    expect(formatSponsorDuration("5509251")).toBe("91 min 49 sec 251 ms");
    expect(formatSponsorDuration("0")).toBe("0 min 0 sec");
  });
  it.each(["=SUM(A1)", "+cmd", "-2+3", "@IMPORT", "  =1", "\t=1", "\nformula", "\u0000=1"])("neutralizes a spreadsheet formula text cell %j", value => {
    expect(sponsorCsvCell(value).startsWith('"\'')).toBe(true);
  });
  it("escapes semicolons, quotes, newlines and Unicode without discarding text", () => {
    expect(sponsorCsvCell('Club; "Zuid"\nÉén')).toBe('"Club; ""Zuid""\nÉén"');
    expect(sponsorCsvCell("123")).toBe('"123"');
  });
  it("exports complete groups and totals with the same halfopen period/cutoff, never raw device identities", () => {
    const report = sponsorReportSchema.parse(fixture);
    const csv = sponsorReportCsv(report);
    expect(report.details).toHaveLength(50);
    expect(csv).toContain('"Totaal";"";"";"5501";"5509251"');
    expect(csv).toContain('"Registratie";"Eigen campagne";"Kantine";"3000";"3000000"');
    expect(csv).toContain("'@Entree; oud (verwijderd)");
    expect(csv).toContain("'=SOM(1;2)");
    expect(csv).toContain('""Club""\nZuid');
    expect(csv).toContain('"Afspraak";"Eigen campagne";"Alle schermen";"";"";"6000"');
    expect(csv).toContain(report.period.from);
    expect(csv).toContain(report.period.until);
    expect(csv).toContain(report.asOf);
    expect(csv).not.toMatch(/device|token|creativeId|planRevisionId|eventId|context_json/u);
    expect(csv).toContain('"QR-scans";"Niet beschikbaar"');
    expect(csv).toContain("Volledigheid niet bevestigd");
  });
  it("exports an empty report and known gaps honestly without inventing QR or target counts", () => {
    const report = sponsorReportSchema.parse({ ...fixture, totals: { acceptedEvents: "0", playedMs: "0" }, details: [], groups: [], goals: [], hasMore: false, coverage: { ...fixture.coverage, status: "partial", gaps: [{ from: fixture.period.from, until: fixture.period.until, reason: "retention" }] } });
    const csv = sponsorReportCsv(report);
    expect(csv).toContain('"Totaal";"";"";"0";"0"');
    expect(csv).toContain('"Bekend gat";"Retentie"');
    expect(csv).not.toContain('"Afspraak";');
    expect(csv).not.toContain('"Registratie";');
  });
});
