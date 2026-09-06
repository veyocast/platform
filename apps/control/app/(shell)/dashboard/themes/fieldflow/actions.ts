"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  authorableThemeIdSchema,
  tenantThemeColorOverridesSchema,
  themeAppearanceSettingsSchema,
  themeModePolicySchema
} from "@veyocast/contracts";
import { editorialThemeHasValidContrast } from "@veyocast/content-templates/editorial-arena-theme";

import { requireTenantCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { tenantSettingsSaveErrorMessage } from "../../settings/settings-save-errors";

export async function updateTenantTheme(formData: FormData) {
  const session = await requireTenantCapability("tenant.settings.manage");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd.");
  }

  const themeId = authorableThemeIdSchema.safeParse(
    String(formData.get("themeId") ?? "")
  );
  const expectedRevision = Number.parseInt(
    String(formData.get("themeSettingsRevision") ?? ""),
    10
  );
  const timezone = String(formData.get("timezoneName") ?? "");
  const colorOverrides = tenantThemeColorOverridesSchema.safeParse(
    parseJson(formData.get("themeColorOverridesJson"), 32_768)
  );
  const appearance = themeAppearanceSettingsSchema.safeParse(
    parseJson(formData.get("themeAppearanceJson"), 8_192)
  );
  const accent = optionalHex(formData.get("themeAccent"));
  const support = optionalHex(formData.get("themeSupport"));
  const policyKind = String(formData.get("themeModePolicyKind") ?? "fixed");
  const modePolicy = themeModePolicySchema.safeParse(
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
            timezone
          }
        : {
            kind: "fixed",
            mode: formData.get("themeFixedMode") === "dark" ? "dark" : "light"
          }
  );

  if (
    !themeId.success ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0 ||
    !modePolicy.success ||
    !appearance.success ||
    !colorOverrides.success ||
    !colorOverrides.data.fieldflow ||
    !editorialThemeHasValidContrast(colorOverrides.data.fieldflow) ||
    accent === false ||
    support === false
  ) {
    fail("De theme-instellingen zijn ongeldig. Controleer kleuren, contrast, fonts en schaal.");
  }

  const { data, error } = await supabase.rpc("update_tenant_theme_settings_v3", {
    p_accent: accent,
    p_appearance: appearance.data,
    p_color_overrides: colorOverrides.data,
    p_expected_revision: expectedRevision,
    p_mode_policy: modePolicy.data,
    p_support: support,
    p_tenant_id: session.tenantId,
    p_theme_id: themeId.data,
    p_theme_version: "1.0.0"
  });
  if (error) {
    console.error("Theme-instellingen opslaan mislukt", error);
    if (error.code === "55000") {
      fail(
        "Er wordt nog een slideversie gepubliceerd. Daardoor kan de geforceerde theme-uitrol nu niet veilig worden vastgezet. Wacht tot die publicatie gereed is en sla de theme-instellingen daarna opnieuw op."
      );
    }
    fail(tenantSettingsSaveErrorMessage(error));
  }
  const result = record(data);
  if (result?.outcome === "conflict") {
    fail("Deze theme-instellingen zijn intussen gewijzigd. Vernieuw de pagina en controleer je aanpassingen.");
  }
  if (result?.outcome === "noop") {
    redirect("/dashboard/themes/fieldflow?succes=Er+waren+geen+theme-wijzigingen+om+uit+te+rollen.");
  }
  if (result?.outcome !== "applied" || !uuid(String(result.rolloutId ?? ""))) {
    console.error("Theme-opslag gaf geen geldige uitrolbevestiging");
    fail("De theme-uitrol kon niet veilig worden bevestigd. Vernieuw de pagina voordat je opnieuw opslaat.");
  }

  revalidatePath("/dashboard/themes");
  revalidatePath("/dashboard/themes/fieldflow");
  revalidatePath("/dashboard/slides");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/themes/fieldflow?succes=Theme+opgeslagen.+Nieuwe+immutable+presentaties+worden+veilig+naar+actieve+schermen+uitgerold.");
}

export async function retryTenantThemeRollout(formData: FormData) {
  const session = await requireTenantCapability("tenant.settings.manage");
  const supabase = await createControlSupabaseClient();
  const rolloutId = String(formData.get("rolloutId") ?? "");
  if (!session.isLive || !session.tenantId || !supabase || !uuid(rolloutId)) {
    fail("Deze theme-uitrol kon niet veilig opnieuw worden gestart.");
  }

  const { data, error } = await supabase.rpc("retry_tenant_theme_rollout_v1", {
    p_idempotency_key: crypto.randomUUID(),
    p_rollout_id: rolloutId,
    p_tenant_id: session.tenantId
  });
  if (error) {
    console.error("Theme-uitrol opnieuw starten mislukt", error);
    fail(tenantSettingsSaveErrorMessage(error));
  }
  const result = record(data);
  if (result?.outcome !== "applied" || !uuid(String(result.rolloutId ?? ""))) {
    console.error("Theme-uitrol gaf geen geldige bevestiging");
    fail("De uitrolstatus kon niet veilig worden bevestigd. Vernieuw de pagina voordat je opnieuw probeert.");
  }

  revalidatePath("/dashboard/themes/fieldflow");
  revalidatePath("/dashboard/slides");
  redirect("/dashboard/themes/fieldflow?succes=De+theme-uitrol+is+opnieuw+veilig+in+de+wachtrij+gezet.");
}

function optionalHex(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : false;
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function parseJson(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}
function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function fail(message: string): never {
  redirect(`/dashboard/themes/fieldflow?fout=${encodeURIComponent(message)}`);
}
