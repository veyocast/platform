import {
  defaultThemeAppearanceSettings,
  tenantThemeColorOverridesSchema,
  themeAppearanceSettingsSchema,
  themeSelectionSchema,
  type EditorialThemeConfig,
  type ThemeAppearanceSettings,
  type ThemeMode,
  type ThemeSelection
} from "@veyocast/contracts";
import { editorialThemeHasValidContrast } from "@veyocast/content-templates/editorial-arena-theme";
import {
  freezeThemePresentation,
  platformDefaultThemeSelection,
  themeCatalog,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";

export type TenantThemeAuthority = {
  appearance: ThemeAppearanceSettings;
  defaults: EditorialThemeConfig;
  selection: ThemeSelection;
  theme: EditorialThemeConfig;
};

export function resolveTenantThemeAuthority(
  settings: Record<string, unknown> | null,
  instant = new Date().toISOString()
): TenantThemeAuthority {
  const selection = tenantThemeSelection(settings);
  const timezone = nonEmptyText(settings?.timezone_name) ?? "Europe/Amsterdam";
  const parsedAppearance = themeAppearanceSettingsSchema.safeParse(
    settings?.appearance_config ?? settings?.theme_appearance
  );
  const appearance = parsedAppearance.success
    ? parsedAppearance.data
    : defaultThemeAppearanceSettings;
  const defaults = generatedTheme(selection, appearance, timezone, instant);
  const overrides = tenantThemeColorOverridesSchema.safeParse(
    settings?.theme_color_overrides
  );
  const configuredTheme = overrides.success
    ? overrides.data.fieldflow
    : undefined;
  const theme = configuredTheme && editorialThemeHasValidContrast(configuredTheme)
    ? { ...configuredTheme, mode: defaults.mode }
    : defaults;

  return {
    appearance,
    defaults,
    selection,
    theme
  };
}

export function tenantThemeSelection(
  settings: Record<string, unknown> | null
): ThemeSelection {
  const parsed = themeSelectionSchema.safeParse({
    accent: nonEmptyText(settings?.theme_accent),
    categoryOverrides: [],
    modePolicy: settings?.theme_mode_policy,
    ref: {
      catalog: "v2",
      id: settings?.default_theme_id,
      version: settings?.default_theme_version
    },
    support: nonEmptyText(settings?.theme_support)
  });
  const selection = parsed.success ? parsed.data : platformDefaultThemeSelection;
  return {
    ...selection,
    ref: {
      catalog: "v2",
      id: "fieldflow",
      version: themeCatalog.fieldflow.version
    }
  };
}

function generatedTheme(
  selection: ThemeSelection,
  appearance: ThemeAppearanceSettings,
  timezone: string,
  instant: string
): EditorialThemeConfig {
  const tokens = (mode: ThemeMode) => themeToEditorialTokens(
    freezeThemePresentation({
      appearance,
      instant,
      selection: { ...selection, modePolicy: { kind: "fixed", mode } },
      timezone
    })
  );
  const presentation = freezeThemePresentation({
    appearance,
    instant,
    selection,
    timezone
  });
  return {
    dark: tokens("dark"),
    light: tokens("light"),
    mode: presentation.resolvedMode.mode
  };
}

function nonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
