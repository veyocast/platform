import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

type EngageMetric = {
  campaign_id: string;
  option_count: number;
  total_votes: number;
};

export async function loadEngageWorkspace(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase || !tenantId) return emptyWorkspace;
  const [flag, campaigns, options, metrics] = await Promise.all([
    supabase.from("tenant_feature_flags").select("enabled").eq("tenant_id", tenantId).eq("flag_key", "engage").maybeSingle(),
    supabase.from("engage_campaigns").select("id,public_id,kind,status,title,question,result_visibility,starts_at,ends_at,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
    supabase.from("engage_options").select("id,campaign_id,label,sort_order").eq("tenant_id", tenantId).order("sort_order"),
    supabase.rpc("get_engage_campaign_metrics_v1", { p_tenant_id: tenantId })
  ]);
  return {
    campaigns: campaigns.data ?? [],
    enabled: flag.data?.enabled === true,
    options: options.data ?? [],
    metrics: (metrics.data ?? []) as EngageMetric[]
  };
}

const emptyWorkspace = { campaigns: [], enabled: false, metrics: [], options: [] };
