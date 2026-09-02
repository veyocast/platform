export const studioSchemaVersion = 1 as const;
export const studioFontRegistryVersions = [
  "2026-07-24.1",
  "2026-09-02.1"
] as const;
export const studioFontRegistryVersion = "2026-09-02.1" as const;
export const studioRendererVersion = "1.1.0" as const;
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
