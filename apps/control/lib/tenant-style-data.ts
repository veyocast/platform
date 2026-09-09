import "server-only";

import {
  freezeThemePresentation,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
import type {
  EditorialThemeConfig,
  ThemeAppearanceSettings,
  ThemePresentationSnapshot,
  ThemeSelection
} from "@veyocast/contracts";

import { createControlSupabaseClient } from "./supabase/server";
import { resolveTenantThemeAuthority } from "./tenant-theme";

export type TenantStyleData = {
  appearance: ThemeAppearanceSettings;
  dark: EditorialThemeConfig["dark"];
  error: string | null;
  light: EditorialThemeConfig["light"];
  presentation: ThemePresentationSnapshot;
  revision: number;
  selection: ThemeSelection;
};

const fallbackSettings = {
  default_theme_id: "fieldflow",
  default_theme_version: "1.0.0",
  theme_mode_policy: { kind: "fixed", mode: "light" },
  timezone_name: "Europe/Amsterdam"
} as const;

export async function loadTenantStyleData(
  tenantId: string | null,
  isLive: boolean,
  instant = new Date().toISOString()
): Promise<TenantStyleData> {
  if (!tenantId || !isLive) return resolveStyle(fallbackSettings, instant, 0, null);

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return resolveStyle(
      fallbackSettings,
      instant,
      0,
      "De actuele clubstijl kon niet worden geladen. De veilige standaard wordt alleen als voorbeeld getoond."
    );
  }

  const [settings, profile] = await Promise.all([
    supabase
      .from("tenant_settings")
      .select("default_theme_id,default_theme_version,theme_mode_policy,theme_accent,theme_support,theme_color_overrides,theme_settings_revision,timezone_name")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_theme_profiles")
      .select("appearance_config,color_overrides,revision,selection_json,theme_version")
      .eq("tenant_id", tenantId)
      .eq("theme_id", "fieldflow")
      .maybeSingle()
  ]);
  const profileSelection = record(profile.data?.selection_json);
  const combined = {
    ...(settings.data ?? fallbackSettings),
    appearance_config: profile.data?.appearance_config,
    default_theme_version:
      profile.data?.theme_version ?? settings.data?.default_theme_version,
    theme_accent: profileSelection?.accent ?? settings.data?.theme_accent,
    theme_color_overrides:
      profile.data?.color_overrides ?? settings.data?.theme_color_overrides,
    theme_mode_policy:
      profileSelection?.modePolicy ?? settings.data?.theme_mode_policy,
    theme_support: profileSelection?.support ?? settings.data?.theme_support
  };
  const error = settings.error ?? profile.error;
  const missing = !settings.data || !profile.data;

  return resolveStyle(
    combined,
    instant,
    Number(profile.data?.revision ?? settings.data?.theme_settings_revision ?? 0),
    error || missing
      ? "De actuele clubstijl kon niet volledig worden gelezen. De preview gebruikt een veilige, niet-opgeslagen standaard."
      : null
  );
}

function resolveStyle(
  settings: Record<string, unknown>,
  instant: string,
  revision: number,
  error: string | null
): TenantStyleData {
  const authority = resolveTenantThemeAuthority(settings, instant);
  const timezone = typeof settings.timezone_name === "string"
    ? settings.timezone_name
    : "Europe/Amsterdam";
  const presentation = freezeThemePresentation({
    appearance: authority.appearance,
    instant,
    selection: authority.selection,
    settingsRevision: Math.max(0, Math.trunc(revision)),
    timezone
  });
  const tokens = (mode: "dark" | "light") => themeToEditorialTokens({
    ...presentation,
    resolvedMode: {
      ...presentation.resolvedMode,
      mode
    }
  });

  return {
    appearance: authority.appearance,
    dark: tokens("dark"),
    error,
    light: tokens("light"),
    presentation,
    revision: Math.max(0, Math.trunc(revision)),
    selection: authority.selection
  };
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
