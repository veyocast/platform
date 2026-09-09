export const studioSchemaVersion = 1 as const;
export const studioFontRegistryVersions = [
  "2026-07-24.1",
  "2026-09-02.1",
  "2026-09-09.1"
] as const;
export const studioFontRegistryVersion = "2026-09-09.1" as const;
export const studioRendererVersion = "1.2.0" as const;
export const studioFps = 30 as const;

export const studioPalette = {
  electricOrange: "#FF5C20",
  fieldflowCloud: "#F4F7F4",
  fieldflowDarkPetrol: "#042F2D",
  fieldflowGreen: "#169B62",
  fieldflowOrange: "#FF7A1A",
  fieldflowPetrol: "#063F3B",
  inkBlack: "#0A0A0A",
  paperWhite: "#FAFAF7",
  surfaceDark: "#171717",
  surfaceWarm: "#24120B",
  warmOrange: "#FFAE72"
} as const;

/**
 * Concrete Navy Glass defaults generated for #2459ED by the shared Royal
 * Current palette engine. Studio documents freeze these values on creation;
 * tenant branding resolves the same semantic roles through that engine.
 */
export const studioRoyalCurrentPalette = {
  accent: "#6A8EF3",
  accentSoft: "#192955",
  background: "#0A1124",
  brandPrimary: "#2459ED",
  canvasEnd: "#0C1428",
  canvasStart: "#131C34",
  danger: "#FF8F95",
  deep: "#070E22",
  flowAccent: "#2459ED",
  ink: "#F5F7FB",
  line: "#434C61",
  muted: "#B2B6BE",
  onAccent: "#101010",
  ownBackground: "#263A73",
  ownInk: "#FFFFFF",
  ownLine: "#63719A",
  ownMuted: "#DEE1EA",
  qrInk: "#000000",
  qrSurface: "#FFFFFF",
  secondaryAccent: "#6A8EF3",
  solidAccent: "#2459ED",
  success: "#74D9A5",
  surface: "#17213A",
  surfaceRaised: "#1F2A49",
  warning: "#FFCBA4"
} as const;

export const studioFormats = [
  {
    id: "landscape-hd",
    label: "Liggend HD",
    orientation: "landscape",
    width: 1920,
    height: 1080
  },
  {
    id: "portrait-hd",
    label: "Staand HD",
    orientation: "portrait",
    width: 1080,
    height: 1920
  }
] as const;

export type StudioFormatId = (typeof studioFormats)[number]["id"];

export const studioFonts = [
  {
    family: "Roboto",
    label: "Roboto",
    weights: [400, 500, 700, 900]
  },
  {
    family: "Inter Variable",
    label: "Inter",
    weights: [400, 500, 600, 700, 800]
  },
  {
    family: "Inter Tight Variable",
    label: "Inter Tight",
    weights: [500, 600, 700, 800]
  },
  {
    family: "Manrope Variable",
    label: "Manrope",
    weights: [400, 500, 600, 700, 800]
  }
] as const;

export type StudioFontFamily = (typeof studioFonts)[number]["family"];

export const studioAnimationPresets = [
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom",
  "pop",
  "bounce",
  "wipe",
  "typewriter",
  "drift",
  "slow-zoom"
] as const;

export type StudioAnimationPreset = (typeof studioAnimationPresets)[number];

export const studioLimits = {
  maxDocumentDurationMs: 30_000,
  maxElements: 200,
  maxNameLength: 120,
  maxTextLength: 1_000,
  minDocumentDurationMs: 1_000,
  safeAreaInset: 64
} as const;
