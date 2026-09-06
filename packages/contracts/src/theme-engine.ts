import { z } from "zod";

export const authorableThemeIds = ["fieldflow"] as const;

export const legacyRenderableThemeIds = [
  "editorial",
  "obsidian",
  "atelier",
  "velocity",
  "heritage",
  "halo",
  "swiss",
  "pavilion",
  "tactical",
  "terrace"
] as const;

export const renderableThemeIds = [
  ...authorableThemeIds,
  ...legacyRenderableThemeIds
] as const;

/** @deprecated Use authorableThemeIds for UI and renderableThemeIds for playback. */
export const selectableThemeIds = renderableThemeIds;

export const themeModes = ["light", "dark"] as const;
export const themeTransitionKeys = [
  "instant-cut",
  "arena-dissolve",
  "editorial-shift",
  "panel-reveal"
] as const;
export const themeMotionStates = [
  "IDLE",
  "ENTERING",
  "ACTIVE",
  "EXITING"
] as const;

export const curatedThemeFontRefs = [
  "vc-inter-v1",
  "vc-newsreader-v1",
  "vc-space-grotesk-v1",
  "vc-fraunces-v1",
  "vc-barlow-condensed-v1",
  "vc-source-serif-4-v1",
  "vc-manrope-v1",
  "vc-cormorant-garamond-v1",
  "vc-ibm-plex-mono-v1",
  "vc-anton-v1"
] as const;

export const selectableThemeIdSchema = z.enum(selectableThemeIds);
export const authorableThemeIdSchema = z.enum(authorableThemeIds);
export const themeModeSchema = z.enum(themeModes);
export const themeTransitionKeySchema = z.enum(themeTransitionKeys);
export const themeMotionStateSchema = z.enum(themeMotionStates);

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const cssHexSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const persistedThemeRefSchema = z.discriminatedUnion("catalog", [
  z.object({
    catalog: z.literal("v2"),
    id: selectableThemeIdSchema,
    version: semverSchema
  }).strict(),
  z.object({
    catalog: z.literal("legacy"),
    legacyThemeId: z.string().trim().min(1).max(120),
    version: z.literal(1)
  }).strict()
]);

export const themeModePolicySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), mode: themeModeSchema }).strict(),
  z.object({ kind: z.literal("auto") }).strict(),
  z.object({
    entries: z.array(z.object({
      days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      end: clockSchema,
      mode: themeModeSchema,
      start: clockSchema
    }).strict()).min(1).max(14),
    fallback: themeModeSchema,
    kind: z.literal("schedule"),
    timezone: z.string().trim().min(1).max(80)
  }).strict()
]);

export const resolvedModeSnapshotSchema = z.object({
  mode: themeModeSchema,
  policy: themeModePolicySchema,
  resolvedAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80)
}).strict();

export const sourceCategoryIdentitySchema = z.object({
  providerConnectionId: z.string().uuid(),
  sourceCategoryId: z.string().trim().min(1).max(200),
  tenantId: z.string().uuid()
}).strict();

export const themeCategoryOverrideSchema = z.object({
  category: sourceCategoryIdentitySchema,
  label: z.string().trim().min(1).max(28).nullable(),
  placement: z.object({
    column: z.enum(["left", "right"]),
    order: z.number().int().min(0).max(100_000)
  }).strict().nullable(),
  revision: z.number().int().min(0)
}).strict();

export const themeSelectionSchema = z.object({
  accent: cssHexSchema.nullable().default(null),
  categoryOverrides: z.array(themeCategoryOverrideSchema).max(40).default([]),
  modePolicy: themeModePolicySchema,
  ref: persistedThemeRefSchema,
  support: cssHexSchema.nullable().default(null)
}).strict();

export const themeAppearanceSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  surfaces: z.object({
    clubLogoBackground: cssHexSchema,
    homeLogoBackground: cssHexSchema
  }).strict(),
  typography: z.object({
    baseScale: z.number().min(0.85).max(1.25),
    bodyFontRef: z.enum(curatedThemeFontRefs),
    displayFontRef: z.enum(curatedThemeFontRefs),
    sportScale: z.number().min(0.9).max(1.4)
  }).strict()
}).strict();

export const defaultThemeAppearanceSettings = {
  schemaVersion: 1,
  surfaces: {
    clubLogoBackground: "#E7F5EE",
    homeLogoBackground: "#FFFFFF"
  },
  typography: {
    baseScale: 1,
    bodyFontRef: "vc-inter-v1",
    displayFontRef: "vc-manrope-v1",
    sportScale: 1.12
  }
} as const satisfies z.infer<typeof themeAppearanceSettingsSchema>;

const themePresentationSnapshotV1Schema = z.object({
  catalogVersion: semverSchema,
  resolvedMode: resolvedModeSnapshotSchema,
  selection: themeSelectionSchema,
  snapshotVersion: z.literal(1)
}).strict();

const themePresentationSnapshotV2Schema = z.object({
  appearance: themeAppearanceSettingsSchema,
  catalogVersion: semverSchema,
  resolvedMode: resolvedModeSnapshotSchema,
  selection: themeSelectionSchema,
  settingsRevision: z.number().int().min(0),
  snapshotVersion: z.literal(2)
}).strict();

export const themePresentationSnapshotSchema = z.discriminatedUnion(
  "snapshotVersion",
  [themePresentationSnapshotV1Schema, themePresentationSnapshotV2Schema]
);

const manifestFontAssetSchema = z.object({
  family: z.string().trim().min(1),
  license: z.literal("OFL-1.1"),
  lockRequirement: z.string().trim().min(1),
  requiredFormat: z.enum([
    "woff2-variable",
    "woff2-variable-or-static-set",
    "woff2"
  ]),
  style: z.literal("normal"),
  weightRange: z.string().trim().min(1)
}).strict();

const manifestPaletteSchema = z.object({
  canvas: cssHexSchema,
  line: z.string().trim().min(1),
  muted: cssHexSchema,
  shadow: z.string().trim().min(1),
  surface: z.string().trim().min(1),
  surfaceAlt: cssHexSchema,
  text: cssHexSchema
}).strict();

export const themeManifestThemeSchema = z.object({
  accentDefault: cssHexSchema,
  bodyFontRef: z.string().trim().min(1),
  dark: manifestPaletteSchema,
  decoration: z.object({
    dataDenseMultiplier: z.number().min(0).max(1),
    id: z.string().trim().min(1),
    intensity: z.number().min(0).max(1)
  }).strict(),
  densityScale: z.number().min(0.75).max(1.25),
  displayFontRef: z.string().trim().min(1),
  displayLetterSpacingEm: z.number().min(-0.2).max(0.2),
  displayWeight: z.number().int().min(100).max(900),
  id: selectableThemeIdSchema,
  light: manifestPaletteSchema,
  motion: z.object({
    default: themeTransitionKeySchema,
    overrides: z.record(z.string(), themeTransitionKeySchema),
    overrideUsageCapPercent: z.number().min(0).max(100)
  }).strict(),
  name: z.string().trim().min(1).max(80),
  primitiveModifiers: z.array(z.string().trim().min(1)).max(12),
  radiusCqw: z.number().min(0).max(10),
  supportDefault: cssHexSchema,
  version: semverSchema
}).strict();

export const themeManifestSchema = z.object({
  $schema: z.string().optional(),
  decorationRecipes: z.record(z.string(), z.record(z.string(), z.unknown())),
  fontAssets: z.record(z.string(), manifestFontAssetSchema),
  logicalCanvases: z.object({
    landscape: z.object({ height: z.literal(1080), width: z.literal(1920) }).strict(),
    portrait: z.object({ height: z.literal(1920), width: z.literal(1080) }).strict()
  }).strict(),
  manifestId: z.literal("veyocast-theme-catalog"),
  manifestVersion: semverSchema,
  shared: z.object({
    baseDisplaySizeCqw: z.number().positive(),
    baseRadiusCqw: z.number().nonnegative(),
    bodyFontRef: z.string().trim().min(1),
    motionFastMs: z.number().int().min(0).max(1_000),
    posterTimeMs: z.literal(900),
    reducedMotionFadeMs: z.number().int().min(0).max(120),
    safeAreaLandscape: z.object({
      blockPercent: z.number().min(0).max(20),
      inlinePercent: z.number().min(0).max(20)
    }).strict(),
    safeAreaPortrait: z.object({
      blockPercent: z.number().min(0).max(20),
      inlinePercent: z.number().min(0).max(20)
    }).strict(),
    surfaceBorderCqw: z.number().positive()
  }).strict(),
  status: z.literal("approved"),
  themes: z.array(themeManifestThemeSchema).length(renderableThemeIds.length),
  transitions: z.record(themeTransitionKeySchema, z.object({
    durationMs: z.number().int().min(0).max(560),
    easing: z.string().trim().min(1),
    translatePercent: z.number().min(0).max(2.5)
  }).strict()),
  visualAcceptance: z.object({
    goldenResolutions: z.array(z.enum(["1920x1080", "1080x1920"])).length(2),
    goldenUpdatePolicy: z.string().trim().min(1),
    maxPerceptualDiffPercent: z.number().max(0.15),
    maxSingleChannelDelta: z.number().int().max(12),
    referencePlatform: z.string().trim().min(1),
    requiredModes: z.array(themeModeSchema).length(2),
    zeroToleranceRegions: z.array(z.string().trim().min(1)).min(1)
  }).strict()
}).strict().superRefine((manifest, context) => {
  const ids = manifest.themes.map((theme) => theme.id);
  for (const requiredId of renderableThemeIds) {
    if (ids.filter((id) => id === requiredId).length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Theme ${requiredId} must occur exactly once.`,
        path: ["themes"]
      });
    }
  }
  for (const [index, theme] of manifest.themes.entries()) {
    for (const fontRef of [theme.bodyFontRef, theme.displayFontRef]) {
      if (!manifest.fontAssets[fontRef]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown font reference ${fontRef}.`,
          path: ["themes", index]
        });
      }
    }
    if (!manifest.decorationRecipes[theme.decoration.id]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown decoration ${theme.decoration.id}.`,
        path: ["themes", index, "decoration", "id"]
      });
    }
  }
});

export type PersistedThemeRef = z.infer<typeof persistedThemeRefSchema>;
export type AuthorableThemeId = z.infer<typeof authorableThemeIdSchema>;
export type ResolvedModeSnapshot = z.infer<typeof resolvedModeSnapshotSchema>;
export type SelectableThemeId = z.infer<typeof selectableThemeIdSchema>;
export type SourceCategoryIdentity = z.infer<typeof sourceCategoryIdentitySchema>;
export type ThemeAppearanceSettings = z.infer<typeof themeAppearanceSettingsSchema>;
export type ThemeCategoryOverride = z.infer<typeof themeCategoryOverrideSchema>;
export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeManifestTheme = z.infer<typeof themeManifestThemeSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ThemeModePolicy = z.infer<typeof themeModePolicySchema>;
export type ThemeMotionState = z.infer<typeof themeMotionStateSchema>;
export type ThemePresentationSnapshot = z.infer<typeof themePresentationSnapshotSchema>;
export type ThemeSelection = z.infer<typeof themeSelectionSchema>;
export type ThemeTransitionKey = z.infer<typeof themeTransitionKeySchema>;
