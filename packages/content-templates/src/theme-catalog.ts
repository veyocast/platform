import {
  selectableThemeIds,
  themeManifestSchema,
  themePresentationSnapshotSchema,
  themeSelectionSchema,
  type EditorialColorTokens,
  type SelectableThemeId,
  type ThemeManifestTheme,
  type ThemeMode,
  type ThemeModePolicy,
  type ThemePresentationSnapshot,
  type ThemeSelection,
  type ThemeTransitionKey
} from "@veyocast/contracts";

import manifestSource from "./THEME-MANIFEST.v1.json";

export const themeManifest = themeManifestSchema.parse(manifestSource);

export const themeCatalog = Object.freeze(
  Object.fromEntries(
    themeManifest.themes.map((theme) => [theme.id, Object.freeze(theme)])
  ) as Record<SelectableThemeId, ThemeManifestTheme>
);

export const themeCatalogOptions = selectableThemeIds.map((id) => ({
  id,
  name: themeCatalog[id].name,
  version: themeCatalog[id].version
}));

export const platformDefaultThemeSelection: ThemeSelection = {
  accent: null,
  categoryOverrides: [],
  modePolicy: { kind: "fixed", mode: "light" },
  ref: {
    catalog: "v2",
    id: "editorial",
    version: themeCatalog.editorial.version
  },
  support: null
};

export function parseThemeSelection(value: unknown): ThemeSelection {
  const parsed = themeSelectionSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return platformDefaultThemeSelection;
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
  instant: string;
  prefersDark?: boolean;
  selection: unknown;
  timezone: string;
}): ThemePresentationSnapshot {
  const selection = parseThemeSelection(input.selection);
  return {
    catalogVersion: themeManifest.manifestVersion,
    resolvedMode: {
      mode: resolveThemeMode(selection.modePolicy, input),
      policy: selection.modePolicy,
      resolvedAt: input.instant,
      timezone: input.timezone
    },
    selection,
    snapshotVersion: 1
  };
}

export function themeCssVariables(
  snapshot: ThemePresentationSnapshot
): Record<string, string | number> {
  const selection = snapshot.selection;
  const theme = resolveThemeDefinition(selection);
  const palette = theme[snapshot.resolvedMode.mode];
  return {
    "--vc-theme-accent": selection.accent ?? theme.accentDefault,
    "--vc-theme-body-font": quoteFont(themeManifest.fontAssets[theme.bodyFontRef]!.family),
    "--vc-theme-canvas": palette.canvas,
    "--vc-theme-density": theme.densityScale,
    "--vc-theme-display-font": quoteFont(themeManifest.fontAssets[theme.displayFontRef]!.family),
    "--vc-theme-display-letter-spacing": `${theme.displayLetterSpacingEm}em`,
    "--vc-theme-display-weight": theme.displayWeight,
    "--vc-theme-line": palette.line,
    "--vc-theme-muted": palette.muted,
    "--vc-theme-radius": `${theme.radiusCqw}cqw`,
    "--vc-theme-shadow": palette.shadow,
    "--vc-theme-support": selection.support ?? theme.supportDefault,
    "--vc-theme-surface": palette.surface,
    "--vc-theme-surface-alt": palette.surfaceAlt,
    "--vc-theme-text": palette.text
  };
}

export function themeToEditorialTokens(
  snapshot: ThemePresentationSnapshot
): EditorialColorTokens {
  const selection = snapshot.selection;
  const theme = resolveThemeDefinition(selection);
  const palette = theme[snapshot.resolvedMode.mode];
  const accent = selection.accent ?? theme.accentDefault;
  const dark = snapshot.resolvedMode.mode === "dark";
  return {
    accent,
    accentSoft: hexAlpha(accent, dark ? 0.2 : 0.14),
    border: palette.line,
    borderSoft: hexAlpha(palette.text, dark ? 0.09 : 0.075),
    canvas: palette.canvas,
    danger: dark ? "#ff716b" : "#d55656",
    divider: palette.line,
    imageOverlayEnd: "rgba(6,8,10,.10)",
    imageOverlayMid: "rgba(6,8,10,.74)",
    imageOverlayStart: "rgba(6,8,10,.97)",
    neutral: dark ? "#8d9095" : "#777b7e",
    panel: palette.surfaceAlt,
    qrInk: "#111315",
    qrSurface: "#f8f6f0",
    row: palette.surface,
    rowSelected: palette.text,
    shadow: palette.shadow,
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

function hexAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function contrastText(hex: string) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16) / 255
  );
  const luminance = channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
  return luminance > 0.46 ? "#111315" : "#fffaf2";
}
