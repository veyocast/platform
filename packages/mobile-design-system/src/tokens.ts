import { veyocastFieldflowTokens } from "@veyocast/tokens";

const vector = veyocastFieldflowTokens;

// Sync V1 source: styles.css :root, .card, .btn and heading/body rules.
// The existing dark preference remains available for native compatibility;
// Sync's authoring reference defines only the light workspace palette.
export const mobilePalette = {
  brand: {
    action: "#006d73",
    actionPressed: "#006066",
    onAction: "#ffffff",
    paper: "#ffffff",
    accentSoft: "#ddf7e9",
    darkAction: vector.semantic.action.default,
    darkActionPressed: vector.semantic.action.pressed,
    darkOnAction: vector.semantic.action.onAction,
    lockedLogoOrange: "#EC622C",
    lockedLogoBlack: "#121212",
  },
  light: {
    canvas: "#f3f7f6",
    surface: "#ffffff",
    raised: "#edf4f1",
    ink: "#122e32",
    // The source muted colour fails normal-text contrast. The native copy
    // uses this measured foreground correction on the same source surfaces.
    secondaryInk: "#51666a",
    mutedInk: "#51666a",
    line: "#e1eae6",
    strongLine: "#718285",
    focus: "#006d73",
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
    focus: vector.themes.dark.focus,
  },
  status: {
    success: vector.semantic.success.default,
    successSurface: "#E8F7EF",
    warning: vector.semantic.warning.default,
    warningSurface: "#FFF0E2",
    critical: vector.semantic.danger.default,
    criticalSurface: "#FDEDEC",
    info: vector.semantic.info.default,
    infoSurface: "#EEF1FF",
  },
  darkStatus: {
    criticalSurface: vector.semantic.danger.surface,
    infoSurface: vector.semantic.info.surface,
    successSurface: vector.semantic.success.surface,
    warningSurface: vector.semantic.warning.surface,
  },
} as const;

export const mobileSpacing = {
  micro: 4,
  compact: 8,
  inline: 12,
  default: 18,
  card: 24,
  section: 28,
  major: 32,
  large: 40,
} as const;

export const mobileRadius = {
  chip: 6,
  control: 10,
  card: 18,
  hero: 22,
  sheet: 22,
  prominent: 22,
  full: vector.radiiPx.pill,
} as const;

export const mobileType = {
  display: { fontSize: 36, lineHeight: 44, fontWeight: "750" },
  pageTitle: { fontSize: 27, lineHeight: 33, fontWeight: "750" },
  section: { fontSize: 21, lineHeight: 26, fontWeight: "750" },
  cardTitle: { fontSize: 17, lineHeight: 21, fontWeight: "750" },
  body: { fontSize: 14, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 14, lineHeight: 22, fontWeight: "650" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "650" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
} as const;

export const mobileFontFamily = {
  regular: "SyncManrope_400Regular",
  book: "SyncManrope_450Book",
  medium: "SyncManrope_500Medium",
  semibold: "SyncManrope_600SemiBold",
  strong: "SyncManrope_650Strong",
  bold: "SyncManrope_700Bold",
  heading: "SyncManrope_750Heading",
} as const;

export function mobileFontFamilyForWeight(weight: number | string | undefined) {
  const numericWeight =
    typeof weight === "number" ? weight : Number.parseInt(weight ?? "400", 10);
  if (numericWeight >= 750) return mobileFontFamily.heading;
  if (numericWeight >= 700) return mobileFontFamily.bold;
  if (numericWeight >= 650) return mobileFontFamily.strong;
  if (numericWeight >= 600) return mobileFontFamily.semibold;
  if (numericWeight >= 500) return mobileFontFamily.medium;
  if (numericWeight >= 450) return mobileFontFamily.book;
  return mobileFontFamily.regular;
}

export const minimumTouchTarget = vector.touch.minimumTargetPx;

export type MobileThemeMode = "dark" | "light";
export type MobileStatusTone =
  | "critical"
  | "info"
  | "neutral"
  | "success"
  | "warning";
