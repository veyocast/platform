import "server-only";

import { sportlinkSeasonInventorySchema, type SportlinkSeasonInventoryRequest } from "@veyocast/contracts";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";

export type SeasonConnection = { id: string; name: string };

export async function loadSeasonConnections(tenantId: string): Promise<{ items: SeasonConnection[]; failed: boolean }> {
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { items: [], failed: true };
    const result = await client.from("sportlink_connections").select("id,detected_club_name")
      .eq("tenant_id", tenantId).neq("status", "revoked").order("id").limit(101);
    if (result.error || !result.data || result.data.length > 100) return { items: [], failed: true };
    return { items: result.data.map(item => ({ id: item.id, name: item.detected_club_name ?? "Sportlink-verbinding" })), failed: false };
  } catch { return { items: [], failed: true }; }
}

export async function loadSeasonInventory(tenantId: string, input: SportlinkSeasonInventoryRequest) {
  try {
    const client = await createControlSupabaseClient();
    if (!client) return { ok: false as const, error: "De beveiligde bronverbinding ontbreekt. Je ontwerpen blijven behouden; probeer opnieuw." };
    const result = await client.rpc("get_sportlink_season_switch_inventory_v1", {
      p_tenant_id: tenantId, p_connection_id: input.connectionId, p_target_season_id: input.targetSeasonId,
      p_filters: input.filters, p_cursor: input.cursor, p_limit: input.pageSize
    });
    const parsed = sportlinkSeasonInventorySchema.safeParse(result.data);
    if (result.error || !parsed.success) return { ok: false as const, error: "De inventaris kon niet volledig worden gecontroleerd. Er is niets gewijzigd. Controleer je bron en rechten en probeer opnieuw." };
    if (parsed.data.connection.id !== input.connectionId || parsed.data.targetSeasonId !== input.targetSeasonId) return { ok: false as const, error: "De bronselectie is intussen gewijzigd. Open de inventaris opnieuw." };
    return { ok: true as const, inventory: parsed.data };
  } catch { return { ok: false as const, error: "De inventaris is tijdelijk niet bereikbaar. Er is niets gewijzigd; probeer dezelfde selectie opnieuw." }; }
}
