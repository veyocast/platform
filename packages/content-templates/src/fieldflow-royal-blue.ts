/**
 * Compatibility exports for the S159 public API. New code should use the
 * Royal Current names from `royal-current-theme`.
 */
import type {
  ThemeAppearanceSettings,
  ThemeMode,
  ThemeSelection
} from "@veyocast/contracts";

import {
  createRoyalCurrentAppearance,
  createRoyalCurrentSelection,
  createRoyalCurrentTheme,
  royalCurrentDefaultStyle,
  royalCurrentPalettePresets
} from "./royal-current-theme";

export const fieldflowRoyalBluePreset = {
  ...royalCurrentPalettePresets[0],
  recipe: "royal-current",
  support: null
} as const;

export const fieldflowRoyalBlueTheme = createRoyalCurrentTheme(
  royalCurrentDefaultStyle,
  "light"
);

export const fieldflowRoyalBlueAppearance = createRoyalCurrentAppearance();

export function createFieldflowRoyalBlueTheme(
  mode: ThemeMode = "light"
) {
  return createRoyalCurrentTheme(royalCurrentDefaultStyle, mode);
}

export function createFieldflowRoyalBlueAppearance(): ThemeAppearanceSettings {
  return createRoyalCurrentAppearance();
}

export function createFieldflowRoyalBlueSelection(
  themeVersion = "1.0.0"
): ThemeSelection {
  return createRoyalCurrentSelection(royalCurrentDefaultStyle, themeVersion);
}
