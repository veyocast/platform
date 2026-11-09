import "server-only";
import { sponsorReportSchema, type SponsorReport } from "@veyocast/contracts";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { SponsorReportFilter } from "./sponsor-report";

export async function loadSponsorReport(tenantId: string, filter: SponsorReportFilter): Promise<{ report: SponsorReport | null; error: boolean }> {
  if (!tenantId) return { report: null, error: true };
  const client = await createControlSupabaseClient();
  if (!client) return { report: null, error: true };
  const response = await client.rpc("get_sponsor_report_v1", {
    p_tenant_id: tenantId, p_from_date: filter.fromDate, p_until_date: filter.untilDate,
    p_campaign_id: filter.campaignId, p_screen_id: filter.screenId, p_as_of: filter.asOf,
    p_before_happened_at: filter.beforeAt, p_before_event_id: filter.beforeId, p_detail_limit: 50
  });
  const parsed = sponsorReportSchema.safeParse(response.data);
  if (response.error || !parsed.success) return { report: null, error: true };
  const report = parsed.data;
  if (report.filters.campaignId !== filter.campaignId || report.filters.screenId !== filter.screenId
    || report.period.fromDate !== filter.fromDate || report.period.untilDate !== filter.untilDate) return { report: null, error: true };
  return { report, error: false };
}
