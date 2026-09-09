import type {
  ClubStyleConfiguration,
  EditorialColorTokens,
  EditorialThemeConfig,
  ThemeAppearanceSettings,
  ThemeMode,
  ThemeSelection
} from "@veyocast/contracts";

export type RoyalCurrentMode = "glass" | "royal";
export type RoyalCurrentTokens = Readonly<Record<
  | "--accent"
  | "--accent-soft"
  | "--bg"
  | "--brand-primary"
  | "--canvas-end"
  | "--canvas-start"
  | "--deep"
  | "--flow-accent"
  | "--ink"
  | "--line"
  | "--matte-rgb"
  | "--muted"
  | "--on-accent"
  | "--own-bg"
  | "--own-ink"
  | "--own-line"
  | "--own-muted"
  | "--secondary-accent"
  | "--solid-accent"
  | "--surface"
  | "--surface-2",
  string
>>;

export const royalCurrentDesignRevision = "royal-current-v8" as const;

export const royalCurrentDefaultStyle = Object.freeze({
  background: "club",
  primary: "#2459ed",
  secondary: null,
  version: 1
} as const satisfies ClubStyleConfiguration);

export const royalCurrentPalettePresets = Object.freeze([
  { color: "#2459ed", id: "blue", label: "Blauw" },
  { color: "#bf263b", id: "red", label: "Rood" },
  { color: "#08734d", id: "green", label: "Groen" },
  { color: "#e06a14", id: "orange", label: "Oranje" },
  { color: "#713dc2", id: "purple", label: "Paars" },
  { color: "#343a46", id: "anthracite", label: "Antraciet" }
] as const);

const paletteCache = new Map<string, RoyalCurrentTokens>();

export function normalizeClubStyle(
  input: Partial<ClubStyleConfiguration> | null | undefined = {}
): ClubStyleConfiguration {
  const source = input ?? {};
  return {
    background: source.background === "neutral" ? "neutral" : "club",
    primary: normalizeClubHex(source.primary) ?? royalCurrentDefaultStyle.primary,
    secondary: normalizeClubHex(source.secondary),
    version: 1
  };
}

export function normalizeClubHex(value: unknown): string | null {
  const source = String(value ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(source)) {
    return `#${source.split("").map((character) => character + character).join("").toLowerCase()}`;
  }
  return /^[0-9a-f]{6}$/i.test(source) ? `#${source.toLowerCase()}` : null;
}

/**
 * Exact, side-effect-free port of prototype v8 `club-theme.js`.
 * Keep this implementation shared by Control, modern playback and Static LG.
 */
export function createRoyalCurrentPalette(
  input: Partial<ClubStyleConfiguration> | null | undefined,
  mode: RoyalCurrentMode = "royal"
): RoyalCurrentTokens {
  const configuration = normalizeClubStyle(input);
  const dark = mode === "glass";
  const neutral = configuration.background === "neutral";
  const cacheKey = [
    configuration.primary,
    configuration.background,
    configuration.secondary,
    dark
  ].join("|");
  const cached = paletteCache.get(cacheKey);
  if (cached) return cached;

  const [primaryHue, primarySaturation] = hsl(configuration.primary);
  const tonal = fromHsl(primaryHue, Math.min(primarySaturation, 0.72), 0.46);
  const hue = neutral ? 0 : primaryHue;
  const saturation = neutral ? 0 : Math.min(primarySaturation, 0.56);
  const background = dark
    ? fromHsl(hue, saturation, 0.09)
    : mix("#ffffff", neutral ? "#6b6b6b" : tonal, 0.052);
  const surface = dark
    ? fromHsl(hue, saturation * 0.76, 0.16)
    : "#ffffff";
  const surface2 = dark
    ? fromHsl(hue, saturation * 0.72, 0.205)
    : mix("#ffffff", neutral ? "#777777" : tonal, 0.1);
  const accentSoft = dark
    ? mix(surface, configuration.primary, 0.15)
    : mix("#ffffff", configuration.primary, 0.085);
  const textBackgrounds = [background, surface, surface2, accentSoft];
  const ink = dark ? "#f5f7fb" : fromHsl(hue, saturation, 0.17);
  const muted = readable(
    dark ? mix(surface, "#ffffff", 0.67) : mix(ink, "#ffffff", 0.3),
    textBackgrounds,
    dark ? "#ffffff" : "#000000"
  );
  const accent = readable(
    configuration.primary,
    textBackgrounds,
    dark ? "#ffffff" : "#000000"
  );
  const secondary = readable(
    configuration.secondary ?? configuration.primary,
    textBackgrounds,
    dark ? "#ffffff" : "#000000"
  );
  const deep = fromHsl(
    hue,
    Math.min(saturation + 0.1, neutral ? 0 : 0.66),
    dark ? 0.08 : 0.19
  );
  const ownBackground = dark
    ? fromHsl(primaryHue, Math.min(primarySaturation, 0.5), 0.3)
    : deep;
  const ownInk = readable("#ffffff", [ownBackground], "#000000");
  const onAccent = contrastRatio("#ffffff", accent) >= 4.5
    ? "#ffffff"
    : "#101010";
  const edge = dark ? mix(surface, ink, 0.2) : mix(surface, ink, 0.16);

  const result = Object.freeze({
    "--accent": accent,
    "--accent-soft": accentSoft,
    "--bg": background,
    "--brand-primary": configuration.primary,
    "--canvas-end": mix(background, surface2, 0.1),
    "--canvas-start": mix(background, surface2, dark ? 0.42 : 0.2),
    "--deep": deep,
    "--flow-accent": configuration.secondary ?? configuration.primary,
    "--ink": ink,
    "--line": edge,
    "--matte-rgb": rgb(surface).join(","),
    "--muted": muted,
    "--on-accent": onAccent,
    "--own-bg": ownBackground,
    "--own-ink": ownInk,
    "--own-line": mix(ownBackground, ownInk, 0.28),
    "--own-muted": mix(ownBackground, ownInk, 0.85),
    "--secondary-accent": secondary,
    "--solid-accent": readable(configuration.primary, ["#ffffff"], "#000000"),
    "--surface": surface,
    "--surface-2": surface2
  }) satisfies RoyalCurrentTokens;
  if (paletteCache.size >= 32) {
    const oldest = paletteCache.keys().next().value;
    if (oldest) paletteCache.delete(oldest);
  }
  paletteCache.set(cacheKey, result);
  return result;
}

export function royalCurrentEditorialTokens(
  input: Partial<ClubStyleConfiguration> | null | undefined,
  mode: ThemeMode
): EditorialColorTokens {
  const tokens = createRoyalCurrentPalette(input, mode === "dark" ? "glass" : "royal");
  const matte = tokens["--matte-rgb"];
  return {
    accent: tokens["--accent"],
    accentSoft: tokens["--accent-soft"],
    border: tokens["--line"],
    borderSoft: tokens["--line"],
    canvas: tokens["--bg"],
    danger: mode === "dark" ? "#ff8f95" : "#a82d3d",
    divider: tokens["--line"],
    imageOverlayEnd: `rgba(${matte},0.08)`,
    imageOverlayMid: `rgba(${matte},0.46)`,
    imageOverlayStart: `rgba(${matte},0.80)`,
    neutral: tokens["--muted"],
    panel: tokens["--surface-2"],
    qrInk: "#000000",
    qrSurface: "#ffffff",
    row: tokens["--surface"],
    rowSelected: tokens["--own-bg"],
    shadow: mode === "dark" ? "rgba(0,0,0,0.28)" : "rgba(19,32,68,0.12)",
    success: mode === "dark" ? "#74d9a5" : "#16623f",
    surface: tokens["--surface"],
    surfaceRaised: tokens["--surface-2"],
    text: tokens["--ink"],
    textFaint: tokens["--muted"],
    textMuted: tokens["--muted"],
    textOnAccent: tokens["--on-accent"],
    textOnSelected: tokens["--own-ink"],
    warning: mode === "dark" ? "#ffcba4" : "#a53c12"
  };
}

export function createRoyalCurrentTheme(
  input: Partial<ClubStyleConfiguration> | null | undefined = royalCurrentDefaultStyle,
  mode: ThemeMode = "light"
): EditorialThemeConfig {
  return {
    dark: royalCurrentEditorialTokens(input, "dark"),
    light: royalCurrentEditorialTokens(input, "light"),
    mode
  };
}

export function createRoyalCurrentAppearance(
  input: Partial<ClubStyleConfiguration> | null | undefined = royalCurrentDefaultStyle,
  current?: ThemeAppearanceSettings
): Extract<ThemeAppearanceSettings, { schemaVersion: 2 }> {
  const palette = normalizeClubStyle(input);
  return {
    designRevision: royalCurrentDesignRevision,
    motionEnabled: current?.schemaVersion === 2 ? current.motionEnabled : true,
    palette: {
      ...palette,
      primary: palette.primary.toUpperCase(),
      secondary: palette.secondary?.toUpperCase() ?? null
    },
    schemaVersion: 2,
    surfaces: {
      clubLogoBackground: current?.surfaces.clubLogoBackground ?? "#FFFFFF",
      homeLogoBackground: current?.surfaces.homeLogoBackground ?? "#FFFFFF"
    },
    typography: {
      baseScale: clamp(current?.typography.baseScale ?? 1, 0.9, 1.2),
      bodyFontRef: current?.typography.bodyFontRef ?? "vc-roboto-v1",
      displayFontRef: current?.typography.displayFontRef ?? "vc-roboto-v1",
      sportScale: clamp(current?.typography.sportScale ?? 1, 0.9, 1.4)
    }
  };
}

export function createRoyalCurrentSelection(
  input: Partial<ClubStyleConfiguration> | null | undefined = royalCurrentDefaultStyle,
  themeVersion = "1.0.0",
  mode: ThemeMode = "light"
): ThemeSelection {
  const palette = normalizeClubStyle(input);
  return {
    accent: palette.primary.toUpperCase(),
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode },
    ref: { catalog: "v2", id: "fieldflow", version: themeVersion },
    support: palette.secondary?.toUpperCase() ?? null
  };
}

export function royalCurrentCssVariables(
  input: Partial<ClubStyleConfiguration> | null | undefined,
  mode: ThemeMode
): Record<string, string> {
  return { ...createRoyalCurrentPalette(input, mode === "dark" ? "glass" : "royal") };
}

export function royalCurrentContrastRatio(foreground: string, background: string) {
  return contrastRatio(foreground, background);
}

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
}

function fromRgb(values: number[]) {
  return `#${values.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(left: string, right: string, amount: number) {
  const rightChannels = rgb(right);
  return fromRgb(rgb(left).map((value, index) => (
    value + (rightChannels[index]! - value) * amount
  )));
}

function hsl(color: string): [number, number, number] {
  const [red, green, blue] = rgb(color).map((value) => value / 255);
  const maximum = Math.max(red!, green!, blue!);
  const minimum = Math.min(red!, green!, blue!);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;
  if (delta) {
    hue = (maximum === red
      ? (green! - blue!) / delta + (green! < blue! ? 6 : 0)
      : maximum === green
        ? (blue! - red!) / delta + 2
        : (red! - green!) / delta + 4) / 6;
  }
  return [
    hue,
    delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0,
    lightness
  ];
}

function fromHsl(hue: number, saturation: number, lightness: number) {
  const channel = (offset: number) => {
    const position = (offset + hue * 12) % 12;
    return 255 * (
      lightness - saturation * Math.min(lightness, 1 - lightness) *
      Math.max(-1, Math.min(position - 3, 9 - position, 1))
    );
  };
  return fromRgb([channel(0), channel(8), channel(4)]);
}

function luminance(color: string) {
  const channels = rgb(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(left: string, right: string) {
  const light = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (light + 0.05) / (dark + 0.05);
}

function readable(
  color: string,
  backgrounds: string[],
  toward: string,
  minimum = 4.5
) {
  for (let index = 0; index <= 100; index += 1) {
    const candidate = mix(color, toward, index / 100);
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= minimum)) {
      return candidate;
    }
  }
  return toward;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
