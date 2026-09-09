import type {
  EditorialThemeConfig,
  ThemeAppearanceSettings,
  ThemePresentationSnapshot,
  ThemeSelection
} from "@veyocast/contracts";

export type TenantStyleData = {
  appearance: ThemeAppearanceSettings;
  dark: EditorialThemeConfig["dark"];
  error: string | null;
  light: EditorialThemeConfig["light"];
  presentation: ThemePresentationSnapshot;
  revision: number;
  selection: ThemeSelection;
};
