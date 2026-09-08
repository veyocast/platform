import {
  editorialArenaConfigurationSchema,
  editorialThemeConfigSchema,
  type EditorialArenaConfiguration,
  type EditorialColorTokens,
  type EditorialThemeConfig
} from "@veyocast/contracts";

export const editorialArenaLightTokens: EditorialColorTokens = {
  accent: "#EC622C",
  accentSoft: "rgba(236, 98, 44, 0.14)",
  border: "rgba(17, 19, 21, 0.12)",
  borderSoft: "rgba(17, 19, 21, 0.075)",
  canvas: "#D7D2C8",
  danger: "#D55656",
  divider: "rgba(17, 19, 21, 0.12)",
  imageOverlayEnd: "rgba(6, 8, 10, 0.08)",
  imageOverlayMid: "rgba(6, 8, 10, 0.72)",
  imageOverlayStart: "rgba(6, 8, 10, 0.96)",
  neutral: "#A9A399",
  panel: "#E8E4DC",
  qrInk: "#111315",
  qrSurface: "#F3F0E9",
  row: "#FBF9F4",
  rowSelected: "#141619",
  shadow: "rgba(66, 55, 41, 0.14)",
  success: "#31A574",
  surface: "#F3F0E9",
  surfaceRaised: "#FBF9F4",
  text: "#111315",
  textFaint: "rgba(17, 19, 21, 0.47)",
  textMuted: "#68665F",
  textOnAccent: "#FFFAF2",
  textOnSelected: "#F7F3EB",
  warning: "#C99431"
};

export const editorialArenaDarkTokens: EditorialColorTokens = {
  accent: "#FF6E37",
  accentSoft: "rgba(255, 110, 55, 0.18)",
  border: "rgba(250, 250, 247, 0.15)",
  borderSoft: "rgba(250, 250, 247, 0.09)",
  canvas: "#090B0E",
  danger: "#FF716B",
  divider: "rgba(250, 250, 247, 0.14)",
  imageOverlayEnd: "rgba(6, 8, 10, 0.12)",
  imageOverlayMid: "rgba(6, 8, 10, 0.76)",
  imageOverlayStart: "rgba(6, 8, 10, 0.98)",
  neutral: "#8D9095",
  panel: "#14181D",
  qrInk: "#111315",
  qrSurface: "#F3F0E9",
  row: "#11161C",
  rowSelected: "#F3F0E9",
  shadow: "rgba(0, 0, 0, 0.34)",
  success: "#46D18C",
  surface: "#0D1116",
  surfaceRaised: "#171C22",
  text: "#F7F3EB",
  textFaint: "rgba(247, 243, 235, 0.48)",
  textMuted: "#B9B5AD",
  textOnAccent: "#111315",
  textOnSelected: "#111315",
  warning: "#FFAD66"
};

export const editorialArenaDefaultTheme: EditorialThemeConfig = {
  dark: editorialArenaDarkTokens,
  light: editorialArenaLightTokens,
  mode: "light"
};

export function resolveEditorialThemeConfig(input: {
  accent?: string;
  canvas?: string;
  mode?: string;
  surface?: string;
  text?: string;
}): EditorialThemeConfig {
  const mode = input.mode === "dark" ? "dark" : "light";
  const base = mode === "dark"
    ? editorialArenaDarkTokens
    : editorialArenaLightTokens;
  const selected = {
    ...base,
    ...(isSupportedColor(input.accent) ? { accent: input.accent } : {}),
    ...(isSupportedColor(input.canvas) ? { canvas: input.canvas } : {}),
    ...(isSupportedColor(input.surface) ? { surface: input.surface } : {}),
    ...(isSupportedColor(input.text) ? { text: input.text } : {})
  };
  return {
    dark: mode === "dark" ? selected : editorialArenaDarkTokens,
    light: mode === "light" ? selected : editorialArenaLightTokens,
    mode
  };
}

export function parseEditorialArenaConfiguration(
  value: unknown,
  fallback: { accent?: string; mode: "dark" | "light" }
): EditorialArenaConfiguration {
  const parsed = editorialArenaConfigurationSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return {
    newsVariant: "hero_split",
    pricePhotoMode: "show",
    schemaVersion: 2,
    theme: resolveEditorialThemeConfig({
      accent: fallback.accent,
      mode: fallback.mode
    })
  };
}

export function activeEditorialTokens(
  theme: EditorialThemeConfig
): EditorialColorTokens {
  const parsed = editorialThemeConfigSchema.safeParse(theme);
  const safeTheme = parsed.success ? parsed.data : editorialArenaDefaultTheme;
  return safeTheme[safeTheme.mode];
}

export function editorialThemeHasValidContrast(
  theme: EditorialThemeConfig,
  minimumRatio = 4.5
) {
  return (["light", "dark"] as const).every((mode) => (
    editorialThemeContrastChecks(theme[mode], minimumRatio)
      .every((check) => check.ready)
  ));
}

export function editorialThemeContrastChecks(
  tokens: EditorialColorTokens,
  minimum = 4.5
) {
  const combinations = [
    ["body", tokens.text, tokens.surface, tokens.canvas],
    ["accent", tokens.textOnAccent, tokens.accent, undefined],
    ["selected", tokens.textOnSelected, tokens.rowSelected, undefined],
    ["photo", tokens.qrSurface, tokens.imageOverlayStart, undefined],
    ["qr", tokens.qrInk, tokens.qrSurface, undefined]
  ] as const;
  return combinations.map(([id, foreground, background, underlay]) => {
    const ratio = contrastRatio(foreground, background, underlay);
    return {
      background,
      foreground,
      id,
      minimum,
      ratio,
      ready: ratio !== null && ratio >= minimum,
      underlay
    };
  });
}

export function editorialThemeCssVariables(
  tokens: EditorialColorTokens
): Record<`--vc-${string}`, string> {
  return {
    "--vc-accent": tokens.accent,
    "--vc-accent-soft": tokens.accentSoft,
    "--vc-border": tokens.border,
    "--vc-border-soft": tokens.borderSoft,
    "--vc-canvas": tokens.canvas,
    "--vc-danger": tokens.danger,
    "--vc-divider": tokens.divider,
    "--vc-image-overlay-end": tokens.imageOverlayEnd,
    "--vc-image-overlay-mid": tokens.imageOverlayMid,
    "--vc-image-overlay-start": tokens.imageOverlayStart,
    "--vc-neutral": tokens.neutral,
    "--vc-panel": tokens.panel,
    "--vc-qr-ink": tokens.qrInk,
    "--vc-qr-surface": tokens.qrSurface,
    "--vc-row": tokens.row,
    "--vc-row-selected": tokens.rowSelected,
    "--vc-shadow": tokens.shadow,
    "--vc-success": tokens.success,
    "--vc-surface": tokens.surface,
    "--vc-surface-raised": tokens.surfaceRaised,
    "--vc-text": tokens.text,
    "--vc-text-faint": tokens.textFaint,
    "--vc-text-muted": tokens.textMuted,
    "--vc-text-on-accent": tokens.textOnAccent,
    "--vc-text-on-selected": tokens.textOnSelected,
    "--vc-warning": tokens.warning
  };
}

export function contrastRatio(
  foreground: string,
  background: string,
  underlay?: string
) {
  const foregroundRgba = parseColor(foreground);
  const backgroundRgba = parseColor(background);
  const underlayRgba = underlay ? parseColor(underlay) : null;
  if (!foregroundRgba || !backgroundRgba || (underlay && !underlayRgba)) {
    return null;
  }
  const underlayRgb = underlayRgba
    ? composite(underlayRgba, [255, 255, 255])
    : [255, 255, 255] as [number, number, number];
  const backgroundRgb = composite(backgroundRgba, underlayRgb);
  const foregroundRgb = composite(foregroundRgba, backgroundRgb);
  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(backgroundRgb);
  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);
  return (light + 0.05) / (dark + 0.05);
}

function isSupportedColor(value: unknown): value is string {
  return typeof value === "string" && (
    /^#[0-9a-f]{6}$/i.test(value.trim()) ||
    /^(rgba?|hsla?)\([0-9.,%\s]+\)$/i.test(value.trim())
  );
}

function parseColor(value: string): [number, number, number, number] | null {
  return parseHex(value) ?? parseRgb(value) ?? parseHsl(value);
}

function parseHex(value: string): [number, number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1]!;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    1
  ];
}

function parseRgb(value: string): [number, number, number, number] | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = match[1]!.split(",").map((part) => part.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const channels = parts.slice(0, 3).map((part) => {
    const parsed = Number.parseFloat(part);
    return part.endsWith("%") ? parsed * 2.55 : parsed;
  });
  const alpha = parts[3] === undefined
    ? 1
    : parts[3]!.endsWith("%")
      ? Number.parseFloat(parts[3]!) / 100
      : Number.parseFloat(parts[3]!);
  if ([...channels, alpha].some((channel) => !Number.isFinite(channel))) return null;
  return [
    clamp(channels[0]!, 0, 255),
    clamp(channels[1]!, 0, 255),
    clamp(channels[2]!, 0, 255),
    clamp(alpha, 0, 1)
  ];
}

function parseHsl(value: string): [number, number, number, number] | null {
  const match = /^hsla?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = match[1]!.split(",").map((part) => part.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const hue = Number.parseFloat(parts[0]!);
  const saturation = Number.parseFloat(parts[1]!) / 100;
  const lightness = Number.parseFloat(parts[2]!) / 100;
  const alpha = parts[3] === undefined
    ? 1
    : parts[3]!.endsWith("%")
      ? Number.parseFloat(parts[3]!) / 100
      : Number.parseFloat(parts[3]!);
  if (
    !parts[1]!.endsWith("%") ||
    !parts[2]!.endsWith("%") ||
    [hue, saturation, lightness, alpha].some((channel) => !Number.isFinite(channel))
  ) return null;
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = sector < 1 ? [chroma, secondary, 0]
    : sector < 2 ? [secondary, chroma, 0]
      : sector < 3 ? [0, chroma, secondary]
        : sector < 4 ? [0, secondary, chroma]
          : sector < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const lightnessOffset = lightness - chroma / 2;
  return [
    (red + lightnessOffset) * 255,
    (green + lightnessOffset) * 255,
    (blue + lightnessOffset) * 255,
    clamp(alpha, 0, 1)
  ];
}

function composite(
  foreground: [number, number, number, number],
  background: [number, number, number]
): [number, number, number] {
  return [0, 1, 2].map((index) => (
    foreground[index]! * foreground[3] + background[index]! * (1 - foreground[3])
  )) as [number, number, number];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function relativeLuminance(rgb: [number, number, number]) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}
