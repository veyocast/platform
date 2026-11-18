import "server-only";

import { hasCapability, type Capability } from "@veyocast/auth";
import { getControlSession } from "../control-session";
import { createControlSupabaseClient } from "../supabase/server";

export async function requireAgentActor(capability?: Capability) {
  const session = await getControlSession();
  const client = await createControlSupabaseClient();
  if (!session?.isLive || !session.tenantId || !session.userId || session.tenantStatus !== "active" || !client || capability && !hasCapability(session.capabilities, capability)) {
    throw Error("Je sessie of rechten zijn gewijzigd. Er is geen agentactie gestart; controleer de actieve vereniging en log zo nodig opnieuw in.");
  }
  const state = await client.rpc("get_ai_agent_state_v1", { p_tenant_id: session.tenantId });
  if (state.error || state.data !== true) throw Error("De AI-agent is niet ingeschakeld voor deze vereniging. Gewone beheerfuncties en bestaande uitzendingen blijven beschikbaar.");
  return { session: { ...session, tenantId: session.tenantId }, client };
}

export function aiEnvironment() {
  const value = process.env.VEYOCAST_ENVIRONMENT;
  if (value === "staging" || value === "production") return value;
  if (process.env.NODE_ENV !== "production" || value === "development") return "development";
  throw Error("De AI-omgeving kon niet veilig worden vastgesteld. Laat de platformconfiguratie controleren.");
}
