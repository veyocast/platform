/**
 * Dependency-free Royal Current palette port for Studio.
 *
 * Studio is intentionally framework/package independent (see the package
 * boundary contract), so it cannot import the renderer package. Keep this
 * small pure implementation in lockstep with content-templates' generator.
 */

export type RoyalCurrentMode = "glass" | "royal";

type ClubStyleConfiguration = {
  background: "club" | "neutral";
  primary: string;
  secondary: string | null;
  version: 1;
};

type RoyalCurrentTokens = Readonly<Record<
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

export function normalizeClubHex(value: unknown): string | null {
  const source = String(value ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(source)) {
    return `#${source.split("").map((character) => character + character).join("").toLowerCase()}`;
  }
  return /^[0-9a-f]{6}$/i.test(source) ? `#${source.toLowerCase()}` : null;
}

function normalizeClubStyle(
  input: Partial<ClubStyleConfiguration> | null | undefined = {}
): ClubStyleConfiguration {
  const source = input ?? {};
  return {
    background: source.background === "neutral" ? "neutral" : "club",
    primary: normalizeClubHex(source.primary) ?? "#2459ed",
    secondary: normalizeClubHex(source.secondary),
    version: 1
  };
}

export function createRoyalCurrentPalette(
  input: Partial<ClubStyleConfiguration> | null | undefined,
  mode: RoyalCurrentMode = "royal"
): RoyalCurrentTokens {
  const configuration = normalizeClubStyle(input);
  const dark = mode === "glass";
  const neutral = configuration.background === "neutral";
  const [primaryHue, primarySaturation] = hsl(configuration.primary);
  const tonal = fromHsl(primaryHue, Math.min(primarySaturation, 0.72), 0.46);
  const hue = neutral ? 0 : primaryHue;
  const saturation = neutral ? 0 : Math.min(primarySaturation, 0.56);
  const background = dark
    ? fromHsl(hue, saturation, 0.09)
    : mix("#ffffff", neutral ? "#6b6b6b" : tonal, 0.052);
  const surface = dark ? fromHsl(hue, saturation * 0.76, 0.16) : "#ffffff";
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
  const onAccent = contrastRatio("#ffffff", accent) >= 4.5 ? "#ffffff" : "#101010";
  const edge = dark ? mix(surface, ink, 0.2) : mix(surface, ink, 0.16);

  return Object.freeze({
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
  });
}

export function royalCurrentEditorialTokens(
  input: Partial<ClubStyleConfiguration> | null | undefined,
  mode: "dark" | "light"
) {
  const tokens = createRoyalCurrentPalette(input, mode === "dark" ? "glass" : "royal");
  return {
    danger: mode === "dark" ? "#ff8f95" : "#a82d3d",
    qrInk: "#000000",
    qrSurface: "#ffffff",
    success: mode === "dark" ? "#74d9a5" : "#16623f",
    warning: mode === "dark" ? "#ffcba4" : "#a53c12",
    ...tokens
  };
}

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
}

function fromRgb(values: number[]) {
  return `#${values.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(left: string, right: string, amount: number) {
  const rightChannels = rgb(right);
  return fromRgb(rgb(left).map((value, index) => value + (rightChannels[index]! - value) * amount));
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
  return [hue, delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0, lightness];
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
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(left: string, right: string) {
  const light = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (light + 0.05) / (dark + 0.05);
}

function readable(color: string, backgrounds: string[], toward: string, minimum = 4.5) {
  for (let index = 0; index <= 100; index += 1) {
    const candidate = mix(color, toward, index / 100);
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= minimum)) return candidate;
  }
  return toward;
}
