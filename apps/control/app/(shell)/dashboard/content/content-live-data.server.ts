import "server-only";
import { hasCapability, type Capability } from "@veyocast/auth";
import type { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { deriveLedScoresFeatureAvailability, parseLedScoresEffectiveState } from "../../../../lib/ledscores-feature-state";

import { contentSearchPattern } from "./content-library";

type Client = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
/** LED overlays retain their own canonical object and editor; never copy them into the library view. */
export async function loadContentLiveSport(client: Client | null, tenantId: string | null, capabilities: readonly Capability[], query = "", archived = false, withItems = true) {
  const empty = { available: false, failed: false, items: [] as { id: string; name: string; href: string }[], more: false };
  if (!client || !tenantId || !hasCapability(capabilities, "tenant.dynamic_slide.read")) return empty;
  try {
    const flag = await client.rpc("get_ledscores_feature_effective_state_v1", { p_tenant_id: tenantId });
    if (flag.error || deriveLedScoresFeatureAvailability(parseLedScoresEffectiveState(flag.data, tenantId)) !== "available") return empty;
    if (!withItems || archived) return { ...empty, available: true };
    let request = client.from("ledscores_goal_alerts").select("id,name,is_central_goal_overlay", { count: "exact" }).eq("tenant_id", tenantId);
    request = archived ? request.eq("status", "archived") : request.neq("status", "archived");
    if (query) {
      const pattern = contentSearchPattern(query);
      request = pattern.operator === "ilike" ? request.ilike("name", pattern.value) : request.filter("name", "imatch", pattern.value);
    }
    const result = await request.order("updated_at", { ascending: false }).order("id").limit(12);
    return { available: true, failed: Boolean(result.error), more: (result.count ?? 0) > 12, items: result.error ? [] : (result.data ?? []).map(row => ({ id: row.id, name: row.name, href: row.is_central_goal_overlay ? "/dashboard/studio/led-scores/goal-overlay" : `/dashboard/studio/led-scores?edit=${row.id}` })) };
  } catch { return { ...empty, failed: true }; }
}
