import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { literalSponsorCrmSearch, sponsorCrmPageSize, type SponsorCrmData, type SponsorCrmFilter } from "./sponsor-crm";

export async function loadSponsorCrm(tenantId: string, filter: SponsorCrmFilter): Promise<SponsorCrmData> {
  const supabase = await createControlSupabaseClient();
  const unavailable: SponsorCrmData = { error: true, opportunities: [], opportunityCount: 0, tasks: [], taskCount: 0 };
  if (!supabase || !tenantId) return unavailable;

  let opportunities = supabase.from("sponsor_opportunities")
    .select("id,name,stage,estimated_value_cents,next_action_at", { count: "exact" })
    .eq("tenant_id", tenantId).order("updated_at", { ascending: false }).order("id");
  let tasks = supabase.from("sponsor_tasks")
    .select("id,title,status,due_at", { count: "exact" })
    .eq("tenant_id", tenantId).order("due_at", { nullsFirst: false }).order("id");
  if (filter.query) {
    const search = literalSponsorCrmSearch(filter.query);
    opportunities = opportunities.filter("name", "imatch", search);
    tasks = tasks.filter("title", "imatch", search);
  }
  if (filter.stage !== "all") opportunities = opportunities.eq("stage", filter.stage);
  if (filter.status !== "all") tasks = tasks.eq("status", filter.status);
  const [opportunityResult, taskResult] = await Promise.all([
    opportunities.range((filter.opportunityPage - 1) * sponsorCrmPageSize, filter.opportunityPage * sponsorCrmPageSize - 1),
    tasks.range((filter.taskPage - 1) * sponsorCrmPageSize, filter.taskPage * sponsorCrmPageSize - 1)
  ]);
  if (opportunityResult.error || taskResult.error) return unavailable;
  return {
    error: false,
    opportunities: opportunityResult.data ?? [],
    opportunityCount: opportunityResult.count ?? 0,
    tasks: taskResult.data ?? [],
    taskCount: taskResult.count ?? 0
  };
}
