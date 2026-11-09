import { hasCapability } from "@veyocast/auth";
import { getControlSession } from "../../../../../lib/control-session";
import { loadSponsorReport } from "../../../../(shell)/dashboard/sponsors/sponsor-report-data";
import { parseSponsorReportFilter, sponsorReportCsv } from "../../../../(shell)/dashboard/sponsors/sponsor-report";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await getControlSession();
  if (!session?.isLive || !session.tenantId || session.tenantStatus === "archived" || !hasCapability(session.capabilities, "tenant.sponsor.read") || !hasCapability(session.capabilities, "tenant.sponsor.report")) return failure(403);
  const query = new URL(request.url).searchParams;
  const params: Record<string, string | string[]> = {};
  for (const key of query.keys()) params[key] = query.getAll(key).length === 1 ? query.get(key)! : query.getAll(key);
  const parsed = parseSponsorReportFilter(params, session.timezoneName);
  if (parsed.invalid || !parsed.filter.asOf) return failure(400);
  const result = await loadSponsorReport(session.tenantId, parsed.filter);
  if (!result.report || result.error) return failure(503);
  return new Response(sponsorReportCsv(result.report), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sponsorrapport-${parsed.filter.fromDate}-${parsed.filter.untilDate}.csv"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
  } });
}
function failure(status: number) {
  return Response.json({ error: "Het sponsorrapport is niet beschikbaar. Controleer je sessie, rapportagerechten en filters en open de rapportage opnieuw." }, { status, headers: { "Cache-Control": "private, no-store" } });
}
