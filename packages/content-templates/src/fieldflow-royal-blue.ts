import type {
  EditorialThemeConfig,
  ThemeAppearanceSettings,
  ThemeMode,
  ThemeSelection
} from "@veyocast/contracts";

export const fieldflowRoyalBluePreset = {
  color: "#4169E1",
  id: "royal-blue",
  label: "Royal blauw",
  recipe: "deep",
  support: "#7A5CE6"
} as const;

export const fieldflowRoyalBlueTheme = {
  dark: {
    accent: "#4169E1",
    accentSoft: "rgba(65, 105, 225, 0.24)",
    border: "rgba(255, 255, 255, 0.22)",
    borderSoft: "rgba(255, 255, 255, 0.12)",
    canvas: "#071538",
    danger: "#FF8580",
    divider: "rgba(255, 255, 255, 0.18)",
    imageOverlayEnd: "rgba(3, 8, 24, 0.10)",
    imageOverlayMid: "rgba(3, 8, 24, 0.72)",
    imageOverlayStart: "rgba(3, 8, 24, 0.96)",
    neutral: "#8697C2",
    panel: "#10265D",
    qrInk: "#071538",
    qrSurface: "#FFFFFF",
    row: "#0C2257",
    rowSelected: "#2447C7",
    shadow: "rgba(0, 0, 0, 0.42)",
    success: "#58D99A",
    surface: "#3154D4",
    surfaceRaised: "#2447A8",
    text: "#FFFFFF",
    textFaint: "rgba(255, 255, 255, 0.82)",
    textMuted: "#E5EBFF",
    textOnAccent: "#FFFFFF",
    textOnSelected: "#FFFFFF",
    warning: "#FFD078"
  },
  light: {
    accent: "#4169E1",
    accentSoft: "rgba(65, 105, 225, 0.22)",
    border: "rgba(255, 255, 255, 0.28)",
    borderSoft: "rgba(255, 255, 255, 0.16)",
    canvas: "#17327A",
    danger: "#FF8F88",
    divider: "rgba(255, 255, 255, 0.22)",
    imageOverlayEnd: "rgba(4, 12, 36, 0.12)",
    imageOverlayMid: "rgba(4, 12, 36, 0.68)",
    imageOverlayStart: "rgba(4, 12, 36, 0.94)",
    neutral: "#AAB9E3",
    panel: "#234AAE",
    qrInk: "#071538",
    qrSurface: "#FFFFFF",
    row: "#1E429C",
    rowSelected: "#3154D4",
    shadow: "rgba(4, 15, 52, 0.32)",
    success: "#67D99F",
    surface: "#365CCB",
    surfaceRaised: "#2A50B8",
    text: "#FFFFFF",
    textFaint: "rgba(255, 255, 255, 0.82)",
    textMuted: "#F4F7FF",
    textOnAccent: "#FFFFFF",
    textOnSelected: "#FFFFFF",
    warning: "#FFD27A"
  },
  mode: "dark"
} as const satisfies EditorialThemeConfig;

export const fieldflowRoyalBlueAppearance = {
  schemaVersion: 1,
  surfaces: {
    clubLogoBackground: "#FFFFFF",
    homeLogoBackground: "#FFFFFF"
  },
  typography: {
    baseScale: 1.05,
    bodyFontRef: "vc-inter-v1",
    displayFontRef: "vc-manrope-v1",
    sportScale: 1.4
  }
} as const satisfies ThemeAppearanceSettings;

export function createFieldflowRoyalBlueTheme(
  mode: ThemeMode = "dark"
): EditorialThemeConfig {
  return {
    dark: { ...fieldflowRoyalBlueTheme.dark },
    light: { ...fieldflowRoyalBlueTheme.light },
    mode
  };
}

export function createFieldflowRoyalBlueAppearance(): ThemeAppearanceSettings {
  return {
    ...fieldflowRoyalBlueAppearance,
    surfaces: { ...fieldflowRoyalBlueAppearance.surfaces },
    typography: { ...fieldflowRoyalBlueAppearance.typography }
  };
}

export function createFieldflowRoyalBlueSelection(
  themeVersion = "1.0.0"
): ThemeSelection {
  return {
    accent: fieldflowRoyalBluePreset.color,
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "dark" },
    ref: {
      catalog: "v2",
      id: "fieldflow",
      version: themeVersion
    },
    support: fieldflowRoyalBluePreset.support
  };
}
