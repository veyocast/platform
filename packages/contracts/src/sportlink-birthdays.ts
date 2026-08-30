import { z } from "zod";

import { themeSelectionSchema } from "./theme-engine";

export const sportlinkBirthdayPeriodModes = [
  "today", "next_7_days", "next_14_days", "next_21_days", "custom"
] as const;
export const sportlinkBirthdayLayouts = [
  "auto", "spotlight", "celebration_grid", "birthday_roll"
] as const;
export const sportlinkBirthdayEmptyBehaviors = [
  "skip", "today_only", "neutral"
] as const;
export const sportlinkBirthdayNameModes = [
  "full", "first_last_initial", "first"
] as const;

const idSchema = z.string().uuid();
const safeColorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i);

export const sportlinkBirthdayConfigurationSchema = z.object({
  emptyBehavior: z.enum(sportlinkBirthdayEmptyBehaviors).default("skip"),
  period: z.object({
    days: z.number().int().min(1).max(21).default(7),
    mode: z.enum(sportlinkBirthdayPeriodModes).default("next_7_days")
  }).strict().default({ days: 7, mode: "next_7_days" }),
  presentation: z.object({
    backgroundColor: safeColorSchema.default("#111827"),
    backgroundMediaAssetId: idSchema.nullable().default(null),
    cardStyle: z.enum(["glass", "solid", "outline"]).default("glass"),
    confetti: z.boolean().default(true),
    gradientOverlay: z.boolean().default(true),
    layout: z.enum(sportlinkBirthdayLayouts).default("auto"),
    logoPosition: z.enum(["top_left", "top_right", "bottom_left"]).default("top_left"),
    maxPerLandscapePage: z.number().int().min(1).max(8).default(4),
    maxPerPortraitPage: z.number().int().min(1).max(8).default(3),
    motion: z.boolean().default(true),
    pageDurationSeconds: z.number().int().min(6).max(20).default(8),
    radius: z.enum(["md", "lg", "xl"]).default("lg"),
    textAlign: z.enum(["left", "center"]).default("left"),
    themeMode: z.enum(["light", "dark"]).default("dark"),
    useTenantTheme: z.boolean().default(true)
  }).strict().default({
    backgroundColor: "#111827", backgroundMediaAssetId: null,
    cardStyle: "glass", confetti: true, gradientOverlay: true,
    layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 4,
    maxPerPortraitPage: 3, motion: true, pageDurationSeconds: 8,
    radius: "lg", textAlign: "left", themeMode: "dark",
    useTenantTheme: true
  }),
  schemaVersion: z.literal(1).default(1),
  selection: z.object({
    emphasizeToday: z.boolean().default(true),
    includeWithoutTeam: z.boolean().optional(),
    includeUnknownRoles: z.boolean().default(true),
    nameMode: z.enum(sportlinkBirthdayNameModes).default("full"),
    roleFilter: z.enum(["all", "players", "staff", "selected"]).default("all"),
    selectedRoles: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    selectedTeamIds: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    showAge: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showDayOfWeek: z.boolean().default(true),
    showPhoto: z.boolean().default(true),
    showRole: z.boolean().default(true),
    showTeam: z.boolean().default(true),
    teamSelectionMode: z.enum(["all", "selected"]).optional()
  }).strict().default({
    emphasizeToday: true, includeWithoutTeam: true, includeUnknownRoles: true,
    nameMode: "full",
    roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: true,
    showDate: true, showDayOfWeek: true, showPhoto: true, showRole: true,
    showTeam: true, teamSelectionMode: "all"
  }),
  themeSelection: themeSelectionSchema.optional(),
  title: z.string().trim().min(1).max(160).default("Verjaardagen")
}).strict().superRefine((configuration, context) => {
  const expectedDays: Partial<Record<(typeof sportlinkBirthdayPeriodModes)[number], number>> = {
    next_14_days: 14, next_21_days: 21, next_7_days: 7, today: 1
  };
  const expected = expectedDays[configuration.period.mode];
  if (expected && configuration.period.days !== expected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "De gekozen periode en het aantal dagen komen niet overeen.",
      path: ["period", "days"]
    });
  }
});

export const canonicalSportlinkBirthdaySchema = z.object({
  age: z.number().int().min(1).max(120).nullable(),
  day: z.number().int().min(1).max(31),
  displayDate: z.string().date(),
  displayName: z.string().trim().min(1).max(160),
  externalId: z.string().trim().min(1).max(200),
  matchStatus: z.enum(["matched", "ambiguous", "unmatched", "manual"]),
  month: z.number().int().min(1).max(12),
  normalizedName: z.string().trim().min(1).max(200),
  photoMediaAssetId: idSchema.nullable(),
  role: z.string().trim().max(80).nullable(),
  teamIds: z.array(z.string().trim().min(1).max(200)).max(20),
  teams: z.array(z.string().trim().min(1).max(120)).max(20)
}).strict();

export const canonicalSportlinkBirthdayFeedSchema = z.object({
  birthdays: z.array(canonicalSportlinkBirthdaySchema).max(250),
  configuration: sportlinkBirthdayConfigurationSchema,
  fetchedAt: z.string().datetime(),
  freshness: z.enum(["fresh", "stale", "expired"]),
  generatedAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80)
}).strict();

export type SportlinkBirthdayConfiguration = z.infer<typeof sportlinkBirthdayConfigurationSchema>;
export type CanonicalSportlinkBirthday = z.infer<typeof canonicalSportlinkBirthdaySchema>;
export type CanonicalSportlinkBirthdayFeed = z.infer<typeof canonicalSportlinkBirthdayFeedSchema>;
