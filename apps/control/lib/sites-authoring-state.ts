import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createControlSupabaseClient } from "./supabase/server";

export type SitesAuthoringState = { tenantId: string; paused: boolean; revision: number };
export const sitesAuthoringPausedMessage = "Nieuwe Sites-ontwerpen en wijzigingen zijn tijdelijk gepauzeerd. Bestaande scherminhoud en herstel blijven beschikbaar.";

export function parseSitesAuthoringState(value: unknown, tenantId: string): SitesAuthoringState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.tenantId !== tenantId || typeof row.paused !== "boolean" || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0) return null;
  return { tenantId, paused: row.paused, revision: Number(row.revision) };
}

export async function loadSitesAuthoringState(client: Pick<SupabaseClient, "rpc">, tenantId: string): Promise<SitesAuthoringState> {
  const result = await client.rpc("get_sites_authoring_state_v1", { p_tenant_id: tenantId });
  const state = result.error ? null : parseSitesAuthoringState(result.data, tenantId);
  if (!state) throw new Error("De authoringstatus kon niet veilig worden gelezen. Vernieuw de pagina voordat je wijzigingen opslaat.");
  return state;
}

export async function readControlSitesAuthoringPaused(tenantId: string | null, isLive: boolean): Promise<boolean> {
  if (!isLive) return false;
  if (!tenantId) return true;
  const client = await createControlSupabaseClient();
  if (!client) return true;
  try { return (await loadSitesAuthoringState(client, tenantId)).paused; }
  catch { return true; }
}
