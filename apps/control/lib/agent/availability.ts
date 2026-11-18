import "server-only";

import { cache } from "react";
import { createControlSupabaseClient } from "../supabase/server";

export const loadAgentAvailability = cache(async (tenantId: string | null, isLive: boolean) => {
  if (!tenantId || !isLive) return false;
  try {
    const client = await createControlSupabaseClient();
    const result = await client?.rpc("get_ai_agent_state_v1", { p_tenant_id: tenantId }).abortSignal(AbortSignal.timeout(1500));
    return !result?.error && result?.data === true;
  } catch { return false; }
});
