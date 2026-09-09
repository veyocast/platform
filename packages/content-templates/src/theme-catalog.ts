import {
  authorableThemeIds,
  defaultThemeAppearanceSettings,
  legacyThemeAppearanceSettings,
  themeManifestSchema,
  themePresentationSnapshotSchema,
  themeSelectionSchema,
  type EditorialColorTokens,
  type SelectableThemeId,
  type ThemeAppearanceSettings,
  type ThemeManifestTheme,
  type ThemeMode,
  type ThemeModePolicy,
  type ThemePresentationSnapshot,
  type ThemeSelection,
  type ThemeTransitionKey
} from "@veyocast/contracts";

import manifestSource from "./THEME-MANIFEST.v1.json";
import { contrastRatio } from "./editorial-arena-theme";
import {
  royalCurrentCssVariables,
  royalCurrentEditorialTokens
} from "./royal-current-theme";

export const themeManifest = themeManifestSchema.parse(manifestSource);

export const themeCatalog = Object.freeze(
  Object.fromEntries(
    themeManifest.themes.map((theme) => [theme.id, Object.freeze(theme)])
  ) as Record<SelectableThemeId, ThemeManifestTheme>
);

export const themeCatalogOptions = authorableThemeIds.map((id) => ({
  id,
  name: themeCatalog[id].name,
  version: themeCatalog[id].version
}));

export const themeBaseFontSizes = [
  10, 11, 11.232, 12, 13, 13.5, 14, 15, 16, 16.5, 17, 18, 18.24,
  19, 19.2, 19.5, 19.968, 20, 20.16, 21, 21.12, 22, 23, 23.04,
  23.76, 24, 25, 25.92, 26, 26.88, 27, 27.84, 28, 28.5, 28.8,
  30, 30.4, 30.72, 31.68, 32, 33, 34, 34.5, 35.2, 36, 37.5, 37.8,
  38.4, 39, 40.32, 41.6, 42, 42.24, 43.2, 45.12, 46, 46.08, 48,
  52, 54, 57.6, 57.996, 58, 59.904, 60, 64, 65.28, 67.2, 68, 72,
  75.6, 76, 80, 82, 84, 90, 92, 96, 100, 111.36, 112, 124.2, 126, 138,
  140, 150, 151.2, 180, 268.8, 270
] as const;

export const platformDefaultThemeSelection: ThemeSelection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed", mode: "light" },
  ref: {
    catalog: "v2",
    id: "fieldflow",
    version: themeCatalog.fieldflow.version
  },
  support: null
};

export function parseThemeSelection(value: unknown): ThemeSelection {
  const parsed = themeSelectionSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error("Theme selection is invalid or references an unknown theme.");
}

export function parseThemePresentationSnapshot(
  value: unknown
): ThemePresentationSnapshot | null {
  const parsed = themePresentationSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveThemeDefinition(
  selection: ThemeSelection
): ThemeManifestTheme {
  if (selection.ref.catalog === "v2") {
    const current = themeCatalog[selection.ref.id];
    if (current && current.version === selection.ref.version) return current;
    throw new Error(
      `Theme ${selection.ref.id}@${selection.ref.version} is not available in this renderer.`
    );
  }
  return themeCatalog.editorial;
}

export function resolveThemeMode(
  policy: ThemeModePolicy,
  input: {
    instant: string;
    prefersDark?: boolean;
    timezone: string;
  }
): ThemeMode {
  if (policy.kind === "fixed") return policy.mode;
  if (policy.kind === "auto") return input.prefersDark ? "dark" : "light";
  const local = localScheduleParts(input.instant, policy.timezone);
  const minutes = local.hour * 60 + local.minute;
  const matching = policy.entries.find((entry) =>
    entry.days.includes(local.weekday) && inClockRange(
      minutes,
      clockMinutes(entry.start),
      clockMinutes(entry.end)
    )
  );
  return matching?.mode ?? policy.fallback;
}

export function freezeThemePresentation(input: {
  appearance?: ThemeAppearanceSettings;
  instant: string;
  prefersDark?: boolean;
  selection: unknown;
  settingsRevision?: number;
  timezone: string;
}): ThemePresentationSnapshot {
  const selection = parseThemeSelection(input.selection);
  const resolvedMode = {
    mode: resolveThemeMode(selection.modePolicy, input),
    policy: selection.modePolicy,
    resolvedAt: input.instant,
    timezone: input.timezone
  };
  if (!input.appearance) {
    return {
      catalogVersion: themeManifest.manifestVersion,
      resolvedMode,
      selection,
      snapshotVersion: 1
    };
  }
  return {
    appearance: input.appearance,
    catalogVersion: themeManifest.manifestVersion,
    resolvedMode,
    selection,
    settingsRevision: Math.max(0, Math.trunc(input.settingsRevision ?? 0)),
    snapshotVersion: 2
  };
}

export function themeCssVariables(
  snapshot: ThemePresentationSnapshot,
  editorialTokens?: EditorialColorTokens
): Record<string, string | number> {
  const selection = snapshot.selection;
  const theme = resolveThemeDefinition(selection);
  const palette = theme[snapshot.resolvedMode.mode];
  const appearance = snapshot.snapshotVersion === 2
    ? snapshot.appearance
    : legacyThemeAppearanceSettings;
  const baseScale = appearance.typography.baseScale;
  const sportScale = baseScale * appearance.typography.sportScale;
  const sportScaleFromDefault = appearance.typography.sportScale /
    (appearance.schemaVersion === 1
      ? legacyThemeAppearanceSettings.typography.sportScale
      : defaultThemeAppearanceSettings.typography.sportScale);
  const royalCurrentVariables = appearance.schemaVersion === 2 &&
    theme.id === "fieldflow"
    ? royalCurrentCssVariables(
        appearance.palette,
        snapshot.resolvedMode.mode
      )
    : {};
  // Royal Current keeps a small set of legacy-facing aliases for the LG
  // projection and for the authored CSS. When a tenant has overridden the
  // semantic palette, those aliases must follow the canonical tokens too;
  // otherwise preview and playback can show different colours.
  const royalCurrentSemanticVariables: Record<string, string | number> = Object.keys(royalCurrentVariables).length && editorialTokens
    ? {
        "--accent": editorialTokens.accent,
        "--accent-soft": editorialTokens.accentSoft,
        "--bg": editorialTokens.canvas,
        // `deep` has no one-to-one EditorialColorTokens role; rowSelected is
        // the canonical Royal Current navy anchor and remains tenant-editable.
        "--deep": editorialTokens.rowSelected,
        "--flow-accent": selection.support ?? editorialTokens.accent,
        "--ink": editorialTokens.text,
        "--line": editorialTokens.border,
        "--muted": editorialTokens.textMuted,
        "--on-accent": editorialTokens.textOnAccent,
        "--own-bg": editorialTokens.rowSelected,
        "--own-ink": editorialTokens.textOnSelected,
        "--own-line": editorialTokens.border,
        "--own-muted": editorialTokens.textMuted,
        "--secondary-accent": selection.support ?? editorialTokens.accent,
        "--solid-accent": editorialTokens.accent,
        "--surface": editorialTokens.surface,
        "--surface-2": editorialTokens.surfaceRaised
      } as Record<string, string | number>
    : {};
  return {
    ...royalCurrentVariables,
    ...royalCurrentSemanticVariables,
    ...themeBaseFontVariables(baseScale),
    "--vc-theme-accent": editorialTokens?.accent ??
      selection.accent ?? theme.accentDefault,
    "--vc-theme-accent-ink": editorialTokens?.textOnAccent ?? palette.canvas,
    "--vc-club-logo-background": appearance.surfaces.clubLogoBackground,
    "--vc-home-logo-background": appearance.surfaces.homeLogoBackground,
    "--vc-theme-base-scale": baseScale,
    "--vc-theme-body-font": quoteFont(
      themeManifest.fontAssets[appearance.typography.bodyFontRef]!.family
    ),
    "--vc-theme-canvas": editorialTokens?.canvas ?? palette.canvas,
    "--vc-theme-density": theme.densityScale,
    "--vc-theme-display-font": quoteFont(
      themeManifest.fontAssets[appearance.typography.displayFontRef]!.family
    ),
    "--vc-theme-display-letter-spacing": `${theme.displayLetterSpacingEm}em`,
    "--vc-theme-display-weight": theme.displayWeight,
    "--vc-theme-line": editorialTokens?.border ?? palette.line,
    "--vc-theme-muted": editorialTokens?.textMuted ?? palette.muted,
    "--vc-theme-radius": `${theme.radiusCqw}cqw`,
    "--vc-theme-shadow": editorialTokens?.shadow ?? palette.shadow,
    "--vc-theme-support": selection.support ?? theme.supportDefault,
    "--vc-theme-surface": editorialTokens?.surface ?? palette.surface,
    "--vc-theme-surface-alt": editorialTokens?.surfaceRaised ?? palette.surfaceAlt,
    "--vc-theme-text": editorialTokens?.text ?? palette.text,
    "--vc-theme-text-muted": editorialTokens?.textMuted ?? palette.muted,
    "--vc-theme-title-size": cssPixels(64 * baseScale),
    "--vc-theme-title-size-portrait": cssPixels(49 * baseScale),
    "--vc-theme-sport-row-size": cssPixels(20 * sportScale),
    "--vc-theme-sport-row-size-portrait": cssPixels(18 * sportScale),
    "--vc-theme-sport-result-size": cssPixels(30 * sportScale),
    "--vc-theme-sport-result-size-compact": cssPixels(
      24 * baseScale * sportScaleFromDefault
    ),
    "--vc-theme-sport-result-size-portrait": cssPixels(27 * sportScale),
    "--vc-theme-sport-score-size": cssPixels(46.5 * sportScale),
    "--vc-theme-sport-score-size-compact": cssPixels(
      42 * baseScale * sportScaleFromDefault
    ),
    "--vc-theme-sport-scale": appearance.typography.sportScale
  };
}

export function themeToEditorialTokens(
  snapshot: ThemePresentationSnapshot
): EditorialColorTokens {
  if (
    snapshot.snapshotVersion === 2 &&
    snapshot.selection.ref.catalog === "v2" &&
    snapshot.selection.ref.id === "fieldflow" &&
    snapshot.appearance.schemaVersion === 2 &&
    snapshot.appearance.designRevision === "royal-current-v8"
  ) {
    return royalCurrentEditorialTokens(
      snapshot.appearance.palette,
      snapshot.resolvedMode.mode
    );
  }
  const selection = snapshot.selection;
  const theme = resolveThemeDefinition(selection);
  const palette = theme[snapshot.resolvedMode.mode];
  const accent = selection.accent ?? theme.accentDefault;
  const dark = snapshot.resolvedMode.mode === "dark";
  const fieldflow = theme.id === "fieldflow";
  return {
    accent,
    accentSoft: hexAlpha(accent, dark ? 0.2 : 0.14),
    border: palette.line,
    borderSoft: hexAlpha(palette.text, dark ? 0.09 : 0.075),
    canvas: palette.canvas,
    danger: dark ? "#ff716b" : "#d55656",
    divider: palette.line,
    imageOverlayEnd: fieldflow ? "rgba(6,8,10,.08)" : "rgba(6,8,10,.10)",
    imageOverlayMid: fieldflow ? "rgba(6,8,10,.58)" : "rgba(6,8,10,.74)",
    imageOverlayStart: fieldflow ? "rgba(6,8,10,.84)" : "rgba(6,8,10,.97)",
    neutral: dark ? "#8d9095" : "#777b7e",
    panel: palette.surfaceAlt,
    qrInk: "#111315",
    qrSurface: "#f8f6f0",
    row: palette.surface,
    rowSelected: palette.text,
    shadow: editorialShadowColor(palette.shadow, dark),
    success: dark ? "#46d18c" : "#257b59",
    surface: palette.surface,
    surfaceRaised: palette.surface,
    text: palette.text,
    textFaint: hexAlpha(palette.text, 0.48),
    textMuted: palette.muted,
    textOnAccent: contrastText(accent),
    textOnSelected: palette.canvas,
    warning: dark ? "#ffad66" : "#9a681d"
  };
}

export function resolveThemeTransition(
  snapshot: ThemePresentationSnapshot,
  family: string,
  reducedMotion: boolean
): { durationMs: number; easing: string; key: ThemeTransitionKey; translatePercent: number } {
  if (reducedMotion) {
    return {
      durationMs: themeManifest.shared.reducedMotionFadeMs,
      easing: "linear",
      key: "instant-cut",
      translatePercent: 0
    };
  }
  const theme = resolveThemeDefinition(snapshot.selection);
  const key = theme.motion.overrides[family] ?? theme.motion.default;
  return { key, ...themeManifest.transitions[key] };
}

function localScheduleParts(instant: string, timezone: string) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Theme mode resolution requires a valid ISO instant.");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
    weekday: "short"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdays: Record<string, number> = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 0,
    Thu: 4,
    Tue: 2,
    Wed: 3
  };
  return {
    hour: Number(read("hour")) % 24,
    minute: Number(read("minute")),
    weekday: weekdays[read("weekday")] ?? 0
  };
}

function clockMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function inClockRange(value: number, start: number, end: number) {
  return start <= end
    ? value >= start && value < end
    : value >= start || value < end;
}

function quoteFont(value: string) {
  return `"${value.replaceAll('"', "")}"`;
}

function themeBaseFontVariables(baseScale: number) {
  return Object.fromEntries(themeBaseFontSizes.map((fontSize) => [
    `--vc-theme-font-${fontSizeToken(fontSize)}`,
    cssPixels(fontSize * baseScale)
  ]));
}

function fontSizeToken(fontSize: number) {
  return String(fontSize).replace(".", "-");
}

function cssPixels(value: number) {
  return `${Math.round(value * 1_000) / 1_000}px`;
}

function hexAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function contrastText(hex: string) {
  const dark = "#090a0b";
  const light = "#fffaf2";
  return (contrastRatio(dark, hex) ?? 0) >= (contrastRatio(light, hex) ?? 0)
    ? dark
    : light;
}

function editorialShadowColor(value: string, dark: boolean) {
  return value.match(/rgba?\([0-9.,%\s]+\)/i)?.[0] ??
    (dark ? "rgba(0,0,0,.34)" : "rgba(66,55,41,.14)");
}
