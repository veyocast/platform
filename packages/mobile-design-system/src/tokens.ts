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
  card: 20,
  section: 24,
  major: 32,
  large: 40
} as const;

export const mobileRadius = {
  chip: 8,
  control: 12,
  card: 16,
  hero: 20,
  sheet: 24,
  prominent: 28,
  full: 999
} as const;

export const mobileType = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "600" },
  pageTitle: { fontSize: 26, lineHeight: 32, fontWeight: "600" },
  section: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "500" }
} as const;

export const minimumTouchTarget = 48;

export type MobileThemeMode = "dark" | "light";
export type MobileStatusTone = "critical" | "info" | "neutral" | "success" | "warning";
