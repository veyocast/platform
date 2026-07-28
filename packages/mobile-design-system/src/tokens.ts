export const mobilePalette = {
  brand: {
    action: "#FF5C20",
    actionPressed: "#E94D14",
    lockedLogoOrange: "#EC622C",
    lockedLogoBlack: "#121212"
  },
  light: {
    canvas: "#F7F3EC",
    surface: "#FFFCF8",
    raised: "#FFFFFF",
    ink: "#1A1917",
    secondaryInk: "#6C6861",
    mutedInk: "#817B72",
    line: "#E7DED2",
    strongLine: "#C9BCAA",
    focus: "#315CFF"
  },
  dark: {
    canvas: "#10100F",
    surface: "#181816",
    raised: "#201F1D",
    ink: "#F8F3EB",
    secondaryInk: "#BEB7AD",
    mutedInk: "#979087",
    line: "#302E2A",
    strongLine: "#4A4640",
    focus: "#8FA4FF"
  },
  status: {
    success: "#18794E",
    successSurface: "#E8F7EF",
    warning: "#B95C00",
    warningSurface: "#FFF0E2",
    critical: "#C7322B",
    criticalSurface: "#FDEDEC",
    info: "#315CFF",
    infoSurface: "#EEF1FF"
  }
} as const;

export const mobileSpacing = {
  micro: 4,
  compact: 8,
  inline: 12,
  default: 16,
  card: 16,
  section: 20,
  major: 24,
  large: 32
} as const;

export const mobileRadius = {
  chip: 6,
  control: 8,
  card: 12,
  hero: 16,
  sheet: 20,
  prominent: 24,
  full: 999
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

export const minimumTouchTarget = 44;

export type MobileThemeMode = "dark" | "light";
export type MobileStatusTone = "critical" | "info" | "neutral" | "success" | "warning";
