import { veyocastVectorTokens } from "@veyocast/tokens";

const vector = veyocastVectorTokens;

export const mobilePalette = {
  brand: {
    action: vector.semantic.action.default,
    actionPressed: vector.semantic.action.pressed,
    onAction: vector.semantic.action.onAction,
    paper: vector.brand.paper,
    lockedLogoOrange: "#EC622C",
    lockedLogoBlack: "#121212"
  },
  light: {
    canvas: vector.themes.light.canvas,
    surface: vector.themes.light.surface,
    raised: vector.themes.light.surfaceRaised,
    ink: vector.themes.light.ink,
    secondaryInk: vector.themes.light.inkMuted,
    mutedInk: vector.themes.light.inkSubtle,
    line: vector.themes.light.line,
    strongLine: vector.themes.light.lineStrong,
    focus: vector.themes.light.focus
  },
  dark: {
    canvas: vector.themes.dark.canvas,
    surface: vector.themes.dark.surface,
    raised: vector.themes.dark.surfaceRaised,
    ink: vector.themes.dark.ink,
    secondaryInk: vector.themes.dark.inkMuted,
    mutedInk: vector.themes.dark.inkSubtle,
    line: vector.themes.dark.line,
    strongLine: vector.themes.dark.lineStrong,
    focus: vector.themes.dark.focus
  },
  status: {
    success: vector.semantic.success.default,
    successSurface: "#E8F7EF",
    warning: vector.semantic.warning.default,
    warningSurface: "#FFF0E2",
    critical: vector.semantic.danger.default,
    criticalSurface: "#FDEDEC",
    info: vector.semantic.info.default,
    infoSurface: "#EEF1FF"
  },
  darkStatus: {
    criticalSurface: vector.semantic.danger.surface,
    infoSurface: vector.semantic.info.surface,
    successSurface: vector.semantic.success.surface,
    warningSurface: vector.semantic.warning.surface
  }
} as const;

export const mobileSpacing = {
  micro: vector.spacingPx[2],
  compact: vector.spacingPx[3],
  inline: vector.spacingPx[4],
  default: vector.spacingPx[5],
  card: vector.spacingPx[5],
  section: vector.spacingPx[6],
  major: vector.spacingPx[7],
  large: vector.spacingPx[8]
} as const;

export const mobileRadius = {
  chip: 6,
  control: vector.radiiPx.control,
  card: vector.radiiPx.card,
  hero: vector.radiiPx.panel,
  sheet: vector.radiiPx.dialog,
  prominent: vector.radiiPx.marketing,
  full: vector.radiiPx.pill
} as const;

export const mobileType = {
  display: { fontSize: 26, lineHeight: 30, fontWeight: "700" },
  pageTitle: { fontSize: 24, lineHeight: 29, fontWeight: "700" },
  section: { fontSize: 18, lineHeight: 23, fontWeight: "600" },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "500" }
} as const;

export const mobileFontFamily = {
  regular: "Roboto_400Regular",
  medium: "Roboto_500Medium",
  semibold: "Roboto_600SemiBold",
  bold: "Roboto_700Bold"
} as const;

export function mobileFontFamilyForWeight(
  weight: number | string | undefined
) {
  const numericWeight =
    typeof weight === "number" ? weight : Number.parseInt(weight ?? "400", 10);
  if (numericWeight >= 700) return mobileFontFamily.bold;
  if (numericWeight >= 600) return mobileFontFamily.semibold;
  if (numericWeight >= 500) return mobileFontFamily.medium;
  return mobileFontFamily.regular;
}

export const minimumTouchTarget = vector.touch.minimumTargetPx;

export type MobileThemeMode = "dark" | "light";
export type MobileStatusTone = "critical" | "info" | "neutral" | "success" | "warning";
