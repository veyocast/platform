import type { SponsorReport } from "@veyocast/contracts";

export type SponsorReportParams = Record<string, string | string[] | undefined>;
export type SponsorReportFilter = {
  fromDate: string; untilDate: string; campaignId: string | null; screenId: string | null;
  asOf: string | null; beforeAt: string | null; beforeId: string | null;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

export function validSponsorReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function parseSponsorReportFilter(params: SponsorReportParams, timezone: string, now = new Date()): { filter: SponsorReportFilter; invalid: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const today = `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
  const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  let invalid = Object.keys(params).some(key => key.startsWith("report") && Array.isArray(params[key]));
  const get = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filter = {
    fromDate: get("reportFrom") || addDays(today, -29), untilDate: get("reportUntil") || addDays(today, 1),
    campaignId: get("reportCampaign") || null, screenId: get("reportScreen") || null,
    asOf: get("reportAsOf") || null, beforeAt: get("reportBeforeAt") || null, beforeId: get("reportBeforeId") || null
  };
  invalid ||= !validSponsorReportDate(filter.fromDate) || !validSponsorReportDate(filter.untilDate)
    || filter.untilDate <= filter.fromDate || Date.parse(filter.untilDate) - Date.parse(filter.fromDate) > 3660 * 86_400_000
    || [filter.campaignId, filter.screenId, filter.beforeId].some(value => value !== null && !uuid.test(value))
    || [filter.asOf, filter.beforeAt].some(value => value !== null && (!isoTime.test(value) || !Number.isFinite(Date.parse(value))))
    || (filter.asOf !== null && Date.parse(filter.asOf) > now.getTime() + 60_000)
    || (filter.beforeAt === null) !== (filter.beforeId === null);
  return { filter, invalid };
}
export function sponsorReportQuery(filter: SponsorReportFilter, asOf?: string, before?: { happenedAt: string; eventId: string }) {
  const query = new URLSearchParams({ report: "1", reportFrom: filter.fromDate, reportUntil: filter.untilDate });
  if (filter.campaignId) query.set("reportCampaign", filter.campaignId);
  if (filter.screenId) query.set("reportScreen", filter.screenId);
  if (asOf ?? filter.asOf) query.set("reportAsOf", (asOf ?? filter.asOf)!);
  if (before) { query.set("reportBeforeAt", before.happenedAt); query.set("reportBeforeId", before.eventId); }
  return query.toString();
}
export function formatSponsorCount(value: string) { return new Intl.NumberFormat("nl-NL").format(BigInt(value)); }
export function formatSponsorDuration(value: string) {
  const milliseconds = BigInt(value);
  return `${formatSponsorCount(String(milliseconds / 60_000n))} min ${milliseconds % 60_000n / 1000n} sec${milliseconds % 1000n ? ` ${milliseconds % 1000n} ms` : ""}`;
}
/** RFC4180 quoting plus spreadsheet formula neutralization for every text cell. */
export function sponsorCsvCell(value: string) {
  let first = 0;
  while (first < value.length && (value.charCodeAt(first) <= 32 || /\s/u.test(value[first]!))) first++;
  const formula = first < value.length && "=+-@".includes(value[first]!);
  const safe = formula || /^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function sponsorReportCsv(report: SponsorReport) {
  const columns = ["Regel", "Campagne (huidige naam)", "Scherm (huidige naam)", "Geaccepteerde afspeelbeurten", "Gemelde speeltijd (ms)", "Afgesproken afspeelbeurten (alle schermen)", "Van (inclusief)", "Tot (exclusief)", "Tijdzone", "Ontvangstpeildatum", "Volledigheid"];
  const context = [report.period.from, report.period.until, report.timezone, report.asOf, report.coverage.status === "partial" ? "Onvolledig: bekend registratie- of retentiegat" : "Volledigheid niet bevestigd"];
  const rows = [columns, ["Totaal", "", "", report.totals.acceptedEvents, report.totals.playedMs, "", ...context],
    ...report.groups.map(group => ["Registratie", group.campaignName, `${group.screenName}${group.screenDeleted ? " (verwijderd)" : ""}`, group.acceptedEvents, group.playedMs, "", ...context]),
    ...report.goals.map(goal => ["Afspraak", goal.campaignName, "Alle schermen", "", "", goal.targetPlays, ...context]),
    ["Meetdefinitie", "Door Player gemelde en geaccepteerde afspeelbeurten; geen meting van publiek, bereik of volledige afspeelbeurten", "", "", "", "", ...context],
    ["QR-scans", "Niet beschikbaar", "", "", "", "", ...context],
    ["Bewaarde gegevens", report.coverage.firstEventAt ?? "Geen events", report.coverage.lastEventAt ?? "Geen events", "", "", "", ...context],
    ...report.coverage.gaps.map(gap => ["Bekend gat", gap.reason === "retention" ? "Retentie" : "Registratiegat", "", "", "", "", gap.from, gap.until, report.timezone, report.asOf, "Onvolledig"])
  ];
  return `\uFEFF${rows.map(row => row.map(sponsorCsvCell).join(";")).join("\r\n")}\r\n`;
}
