"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  authorableThemeIdSchema,
  tenantThemeColorOverridesSchema,
  themeModePolicySchema
} from "@veyocast/contracts";
import { editorialThemeHasValidContrast } from "@veyocast/content-templates/editorial-arena-theme";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { tenantSettingsSaveErrorMessage } from "./settings-save-errors";

export async function updateTenantSettings(formData: FormData) {
  const session = await requireTenantCapability("tenant.settings.manage");
  const supabase = await createControlSupabaseClient();

  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets opgeslagen; herstel de configuratie en log opnieuw in.");
  }
  const name = String(formData.get("name") ?? "").trim();
  const primaryColor = String(formData.get("primaryColor") ?? "")
    .trim()
    .toUpperCase();
  const imageDuration = integerValue(formData, "defaultImageDuration");
  const fitMode = String(formData.get("defaultFitMode") ?? "");
  const videoMuted = formData.get("defaultVideoMuted") === "on";
  const orientation = String(formData.get("defaultScreenOrientation") ?? "");
  const resolutionWidth = integerValue(formData, "defaultResolutionWidth");
  const resolutionHeight = integerValue(formData, "defaultResolutionHeight");
  const timezoneName = String(formData.get("timezoneName") ?? "");
  const defaultTransition = String(formData.get("defaultTransition") ?? "cut");
  const defaultBackgroundColor = String(formData.get("defaultBackgroundColor") ?? "").trim();
  const themeId = String(formData.get("themeId") ?? "");
  const authorableThemeId = authorableThemeIdSchema.safeParse(themeId);
  const themeExpectedRevision = integerValue(formData, "themeSettingsRevision");
  const themeAccent = optionalHex(formData.get("themeAccent"));
  const themeSupport = optionalHex(formData.get("themeSupport"));
  const themeColorOverrides = tenantThemeColorOverridesSchema.safeParse(
    parseJson(formData.get("themeColorOverridesJson"))
  );
  const policyKind = String(formData.get("themeModePolicyKind") ?? "fixed");
  const themeModePolicy = themeModePolicySchema.safeParse(
    policyKind === "auto"
      ? { kind: "auto" }
      : policyKind === "schedule"
        ? {
            entries: [{
              days: [0, 1, 2, 3, 4, 5, 6],
              end: String(formData.get("themeScheduleEnd") ?? "07:00"),
              mode: "dark",
              start: String(formData.get("themeScheduleStart") ?? "18:00")
            }],
            fallback: "light",
            kind: "schedule",
            timezone: timezoneName
          }
        : {
            kind: "fixed",
            mode: formData.get("themeFixedMode") === "dark" ? "dark" : "light"
          }
  );

  if (name.length < 2 || name.length > 120) {
    fail("Gebruik een verenigingsnaam van 2 tot en met 120 tekens.");
  }
  if (!/^#[0-9A-F]{6}$/.test(primaryColor)) {
    fail("Gebruik voor de primaire kleur een geldige hexkleur, zoals #315CFF.");
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
  if (!["Europe/Amsterdam", "Europe/Berlin", "Europe/Brussels", "Europe/London", "Europe/Paris"].includes(timezoneName)) {
    fail("Kies een ondersteunde lokale tijdzone.");
  }
  if (!["cut", "crossfade", "wipe"].includes(defaultTransition)) {
    fail("De standaardovergang is ongeldig.");
  }
  if (defaultBackgroundColor && !/^#[0-9a-f]{6}$/i.test(defaultBackgroundColor)) {
    fail("De standaardachtergrondkleur is ongeldig.");
  }
  if (!authorableThemeId.success || !themeModePolicy.success || themeExpectedRevision < 0) {
    fail("De themastandaard of het licht/donker-beleid is ongeldig.");
  }
  if (themeAccent === false || themeSupport === false) {
    fail("Gebruik voor thema-accenten een geldige hexkleur of laat het veld leeg.");
  }
  if (
    !themeColorOverrides.success ||
    !themeColorOverrides.data.fieldflow ||
    !editorialThemeHasValidContrast(themeColorOverrides.data.fieldflow)
  ) {
    fail("De centrale slidekleuren zijn ongeldig of hebben onvoldoende contrast. Controleer tekst, panelen, foto-overlay en QR-code.");
  }

  const { error } = await supabase.rpc("update_tenant_control_settings_v5", {
    p_default_background_color: defaultBackgroundColor || null,
    p_default_fit_mode: fitMode,
    p_default_image_duration_seconds: imageDuration,
    p_default_resolution_height: resolutionHeight,
    p_default_resolution_width: resolutionWidth,
    p_default_screen_orientation: orientation,
    p_default_transition: defaultTransition,
    p_default_video_muted: videoMuted,
    p_name: name,
    p_primary_color: primaryColor,
    p_theme_accent: themeAccent,
    p_theme_color_overrides: themeColorOverrides.data,
    p_theme_expected_revision: themeExpectedRevision,
    p_theme_id: authorableThemeId.data,
    p_theme_mode_policy: themeModePolicy.data,
    p_theme_support: themeSupport,
    p_theme_version: "1.0.0",
    p_tenant_id: session.tenantId,
    p_timezone_name: timezoneName
  });

  if (error) {
    console.error("Tenantinstellingen opslaan mislukt", error);
    fail(tenantSettingsSaveErrorMessage(error));
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings?succes=De+verenigings-,+huisstijl-+en+afspeelstandaarden+zijn+opgeslagen.");
}

function optionalHex(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : false;
}

function integerValue(formData: FormData, name: string) {
  return Number.parseInt(String(formData.get(name) ?? ""), 10);
}

function parseJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 32_768) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function fail(message: string): never {
  redirect(`/dashboard/settings?fout=${encodeURIComponent(message)}`);
}
