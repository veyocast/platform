"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const managementRoles = new Set([
  "platform_owner",
  "platform_admin",
  "tenant_owner",
  "tenant_admin"
]);

export async function updateTenantSettings(formData: FormData) {
  const session = await requireControlSession();
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets opgeslagen; herstel de configuratie en log opnieuw in.");
  }
  if (!session.roles.some((role) => managementRoles.has(role))) {
    fail("Je hebt beheerrechten nodig. Er is niets opgeslagen; vraag een tenantbeheerder om deze wijziging uit te voeren.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const imageDuration = integerValue(formData, "defaultImageDuration");
  const fitMode = String(formData.get("defaultFitMode") ?? "");
  const videoMuted = formData.get("defaultVideoMuted") === "on";
  const orientation = String(formData.get("defaultScreenOrientation") ?? "");
  const resolutionWidth = integerValue(formData, "defaultResolutionWidth");
  const resolutionHeight = integerValue(formData, "defaultResolutionHeight");

  if (name.length < 2 || name.length > 120) {
    fail("Gebruik een verenigingsnaam van 2 tot en met 120 tekens.");
  }
  if (imageDuration < 5 || imageDuration > 3600) {
    fail("De standaard afbeeldingsduur moet tussen 5 en 3600 seconden liggen.");
  }
  if (!['contain', 'cover'].includes(fitMode)) {
    fail("Kies volledig in beeld of schermvullend als standaard weergave.");
  }
  if (!['landscape', 'portrait'].includes(orientation)) {
    fail("Kies liggend of staand als standaardschermoriëntatie.");
  }
  if (resolutionWidth < 320 || resolutionWidth > 7680 || resolutionHeight < 240 || resolutionHeight > 4320) {
    fail("De standaardresolutie valt buiten het ondersteunde bereik.");
  }

  const { error } = await supabase.rpc("update_tenant_control_settings", {
    p_default_fit_mode: fitMode,
    p_default_image_duration_seconds: imageDuration,
    p_default_resolution_height: resolutionHeight,
    p_default_resolution_width: resolutionWidth,
    p_default_screen_orientation: orientation,
    p_default_video_muted: videoMuted,
    p_name: name,
    p_tenant_id: session.tenantId
  });

  if (error) {
    console.error("Tenantinstellingen opslaan mislukt", error);
    fail("De instellingen konden niet veilig worden opgeslagen. Er is niets gedeeltelijk gewijzigd; controleer je rechten en probeer opnieuw.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings?succes=De+verenigings-+en+afspeelstandaarden+zijn+opgeslagen.");
}

function integerValue(formData: FormData, name: string) {
  return Number.parseInt(String(formData.get(name) ?? ""), 10);
}

function fail(message: string): never {
  redirect(`/dashboard/settings?fout=${encodeURIComponent(message)}`);
}
