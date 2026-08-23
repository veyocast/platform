"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sportlinkSlideBlueprintKeys } from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createOrResumeDynamicSlideVersion(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const slideId = String(formData.get("slideId") ?? "");
  const basisVersionId = String(formData.get("basisVersionId") ?? "");
  if (!uuidPattern.test(slideId) || (basisVersionId && !uuidPattern.test(basisVersionId))) {
    redirect("/dashboard/slides?fout=De+gekozen+slideversie+is+ongeldig.");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    redirect(`/dashboard/slides/${slideId}?fout=De+veilige+verbinding+is+niet+beschikbaar.`);
  }
  const slide = await supabase
    .from("dynamic_slides")
    .select("slide_type,configuration_json")
    .eq("tenant_id", session.tenantId)
    .eq("id", slideId)
    .neq("status", "archived")
    .maybeSingle();
  const configuration = record(slide.data?.configuration_json);
  const menu = slide.data?.slide_type === "price_list" && configuration?.schemaVersion === "menu-document.v2";
  const sportlink = typeof configuration?.blueprintKey === "string" &&
    sportlinkSlideBlueprintKeys.includes(configuration.blueprintKey as (typeof sportlinkSlideBlueprintKeys)[number]);
  if (slide.error || !slide.data || (!menu && !sportlink)) {
    redirect(`/dashboard/slides/${slideId}?fout=Voor+dit+slidetype+is+veilig+versioneren+nog+niet+beschikbaar.`);
  }
  const result = await supabase.rpc("create_or_resume_dynamic_slide_version_v1", {
    p_basis_version_id: basisVersionId || null,
    p_slide_id: slideId
  });
  if (result.error) {
    const message = result.error.code === "42501"
      ? "Je+hebt+geen+toestemming+om+een+nieuwe+versie+te+maken."
      : "De+nieuwe+versie+kon+niet+veilig+worden+aangemaakt.";
    redirect(`/dashboard/slides/${slideId}?fout=${message}`);
  }
  revalidatePath("/dashboard/slides");
  revalidatePath(`/dashboard/slides/${slideId}`);
  redirect(menu
    ? `/dashboard/slides/menu-studio/${slideId}?succes=De+conceptversie+staat+klaar.`
    : `/dashboard/slides/${slideId}/edit?succes=De+conceptversie+staat+klaar.`);
}

export async function publishDynamicSlideVersion(input: {
  expectedRevision: number;
  slideId: string;
  versionId: string;
}) {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  if (
    !uuidPattern.test(input.slideId) ||
    !uuidPattern.test(input.versionId) ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    return { code: "VERSION_INPUT_INVALID", message: "De publicatieopdracht is ongeldig.", ok: false } as const;
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return { code: "VERSION_UNAVAILABLE", message: "Publiceren is momenteel niet beschikbaar.", ok: false } as const;
  }
  const result = await supabase.rpc("publish_dynamic_slide_version_v1", {
    p_expected_revision: input.expectedRevision,
    p_slide_id: input.slideId,
    p_version_id: input.versionId
  });
  if (result.error) {
    return {
      code: result.error.code ?? "VERSION_PUBLISH_FAILED",
      message: result.error.code === "42501"
        ? "Je hebt geen toestemming om deze versie te publiceren."
        : result.error.code === "40001"
          ? "Deze conceptversie is intussen gewijzigd. Vernieuw de pagina."
          : "De versie kon niet worden gepubliceerd. De huidige versie blijft actief.",
      ok: false
    } as const;
  }
  const response = record(result.data);
  if (response?.outcome === "conflict") {
    return {
      code: "VERSION_PUBLISH_CONFLICT",
      message: "Deze conceptversie is intussen gewijzigd. Vernieuw de pagina voordat je publiceert.",
      ok: false
    } as const;
  }
  revalidatePath("/dashboard/slides");
  revalidatePath(`/dashboard/slides/${input.slideId}`);
  revalidatePath(`/dashboard/slides/menu-studio/${input.slideId}`);
  return { ok: true, outcome: "publishing" as const };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
