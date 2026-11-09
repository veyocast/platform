import "server-only";
import { effectivePlanningScreenIdsSchema } from "@veyocast/contracts";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { effectivePlanningSchema, type PlanningPreviewResult, type PlanningProposal } from "./effective-planning";


export async function loadEffectivePlanning(tenantId: string, input: {
  screenIds: string[]; at?: string; horizonDays?: number; proposal?: PlanningProposal; defaultPlaylistId?: string;
}): Promise<PlanningPreviewResult> {
  if (!effectivePlanningScreenIdsSchema.safeParse(input.screenIds).success) return { report: null, error: "Kies één tot en met vijftig verschillende schermen." };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { report: null, error: "De beveiligde datasessie ontbreekt. Er is niets gewijzigd." };
  const { data, error } = await supabase.rpc("preview_effective_planning_v1", {
    p_tenant_id: tenantId, p_screen_ids: input.screenIds, p_at: input.at ?? new Date().toISOString(),
    p_horizon_days: input.horizonDays ?? 8, p_proposal: input.proposal ?? null,
    p_default_playlist_id: input.defaultPlaylistId ?? null
  });
  const parsed = effectivePlanningSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("Effectieve planning niet beschikbaar", { code: error?.code ?? "INVALID_PLANNING_RESPONSE" });
    return { report: null, error: error?.code === "42501"
      ? "Je mag deze schermen of planning niet beoordelen. Er is niets gewijzigd."
      : error?.code === "PT409" ? "De planning is sinds de controle gewijzigd. Vernieuw de pagina en controleer opnieuw."
      : "De effectieve planning kon niet volledig worden gecontroleerd. Probeer opnieuw; er is niets gewijzigd." };
  }
  return { report: parsed.data, error: null };
}
