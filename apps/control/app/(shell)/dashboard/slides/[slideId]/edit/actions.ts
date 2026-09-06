"use server";

import { revalidatePath } from "next/cache";

import { sportlinkSlideDraftSchema } from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";

export async function saveSportlinkSlideVersion(input: {
  dataSourceId: string;
  draft: unknown;
  expectedRevision: number;
  slideId: string;
  versionId: string;
}) {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  const draft = sportlinkSlideDraftSchema.safeParse(input.draft);
  if (
    !draft.success || !uuidPattern.test(input.dataSourceId) || !uuidPattern.test(input.slideId) ||
    !uuidPattern.test(input.versionId) ||
    !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
  ) {
    return { code: "SPORTLINK_VERSION_INVALID", message: draft.success ? "De conceptversie is ongeldig." : draft.error.issues[0]?.message ?? "Controleer de invoer.", ok: false } as const;
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { code: "SPORTLINK_VERSION_UNAVAILABLE", message: "Opslaan is momenteel niet beschikbaar.", ok: false } as const;
  const existing = await supabase
    .from("dynamic_slide_versions")
    .select("configuration_json")
    .eq("id", input.versionId)
    .eq("dynamic_slide_id", input.slideId)
    .eq("status", "draft")
    .maybeSingle();
  if (existing.error || !existing.data) {
    return { code: "SPORTLINK_VERSION_NOT_FOUND", message: "De conceptversie bestaat niet meer of is al gepubliceerd.", ok: false } as const;
  }
  const existingConfiguration = record(existing.data.configuration_json) ?? {};
  const configuration = {
    ...existingConfiguration,
    arrival: draft.data.arrival,
    blueprintKey: draft.data.blueprintKey,
    context: draft.data.context,
    teamContexts: draft.data.teamContexts,
    teamSelection: draft.data.teamSelection,
    display: draft.data.display,
    editorial: {
      ...(record(existingConfiguration.editorial) ?? {}),
      schemaVersion: 2,
      themeSelection: draft.data.themeSelection
    },
    maxItems: typeof existingConfiguration.maxItems === "number"
      ? existingConfiguration.maxItems
      : 40,
    schemaVersion: 1,
    title: draft.data.title
  };
  const result = await supabase.rpc("save_dynamic_slide_version_v1", {
    p_configuration: configuration,
    p_data_source_id: input.dataSourceId,
    p_expected_revision: input.expectedRevision,
    p_name: draft.data.name,
    p_orientation: draft.data.orientation,
    p_selection_mode: "latest",
    p_slide_id: input.slideId,
    p_template_version_id: draft.data.templateVersionId,
    p_theme_selection: draft.data.themeSelection,
    p_version_id: input.versionId
  });
  if (result.error) {
    return {
      code: result.error.code ?? "SPORTLINK_VERSION_SAVE_FAILED",
      message: result.error.code === "42501"
        ? "Je hebt geen toestemming om deze versie te wijzigen."
        : "Opslaan is mislukt. De huidige gepubliceerde versie is niet aangepast.",
      ok: false
    } as const;
  }
  const response = record(result.data);
  if (response?.outcome === "conflict") {
    return { code: "SPORTLINK_VERSION_CONFLICT", message: "Deze conceptversie is intussen gewijzigd. Vernieuw de pagina.", ok: false } as const;
  }
  const editRevision = Number(response?.editRevision);
  if (!Number.isInteger(editRevision)) return { code: "SPORTLINK_VERSION_RESPONSE_INVALID", message: "De server bevestigde de wijziging niet.", ok: false } as const;
  revalidatePath(`/dashboard/slides/${input.slideId}`);
  revalidatePath(`/dashboard/slides/${input.slideId}/edit`);
  return { editRevision, ok: true } as const;
}

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
