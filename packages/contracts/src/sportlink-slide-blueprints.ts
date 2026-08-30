import { z } from "zod";

import { themeSelectionSchema } from "./theme-engine";

export const sportlinkSlideBlueprintKeys = [
  "sportlink.club_schedule_today",
  "sportlink.club_schedule_next_7_days",
  "sportlink.club_results_today",
  "sportlink.club_results_previous_7_days",
  "sportlink.pool_schedule_next_7_days",
  "sportlink.pool_results_previous_7_days",
  "sportlink.pool_standings",
  "sportlink.visitor_arrivals",
  "sportlink.referee_arrivals"
] as const;

export type SportlinkSlideBlueprintKey =
  (typeof sportlinkSlideBlueprintKeys)[number];

export const sportlinkCompetitionSelectionModes = [
  "auto_current",
  "pinned"
] as const;

export const sportlinkArrivalMotionPresets = [
  "auto",
  "aurora-rise",
  "spotlight-bloom",
  "kinetic-split",
  "prism-swipe",
  "grand-flip"
] as const;

export const sportlinkArrivalWindowMaxMinutes = 42 * 24 * 60;

export const sportlinkSlideContextSchema = z.object({
  competitionId: z.string().trim().min(1).max(200).nullable(),
  competitionSelectionMode: z.enum(sportlinkCompetitionSelectionModes),
  phaseId: z.string().trim().min(1).max(200).nullable(),
  poolId: z.string().trim().min(1).max(200).nullable(),
  providerTeamId: z.string().trim().min(1).max(200),
  seasonId: z.string().trim().min(1).max(80).nullable()
}).strict();

export const sportlinkArrivalConfigSchema = z.object({
  cardCount: z.number().int().min(1).max(4).default(4),
  dutyDeskText: z.string().trim().max(120).nullable().default(null),
  emptyBehavior: z.enum(["skip", "placeholder"]).default("skip"),
  highlightRecentMinutes: z.number().int().min(0).max(180).default(15),
  minutesAfter: z.number().int().min(0).max(sportlinkArrivalWindowMaxMinutes).default(30),
  minutesBefore: z.number().int().min(0).max(sportlinkArrivalWindowMaxMinutes).default(90),
  motionPreset: z.enum(sportlinkArrivalMotionPresets).default("auto"),
  pageDurationSeconds: z.number().int().min(5).max(120).default(12),
  placeholderText: z.string().trim().min(1).max(160).default("Er worden nu geen teams verwacht."),
  showArrivalTime: z.boolean().default(true),
  showClubLogo: z.boolean().default(true),
  showCompetition: z.boolean().default(false),
  showDressingRoom: z.boolean().default(true),
  showField: z.boolean().default(true),
  showKickoffTime: z.boolean().default(true),
  showSponsor: z.boolean().default(false),
  showWelcome: z.boolean().default(true),
  sponsorMediaAssetId: z.string().uuid().nullable().default(null),
  welcomeText: z.string().trim().min(1).max(80).default("Welkom bij {{club}}")
}).strict();

export const sportlinkDisplayConfigSchema = z.object({
  columns: z.enum(["one", "two"]).default("two"),
  showDressingRoom: z.boolean().default(false),
  showField: z.boolean().default(true),
  showHomeAway: z.boolean().default(true),
  showReferee: z.boolean().default(false)
}).strict();

export const sportlinkSlideDraftSchema = z.object({
  blueprintKey: z.enum(sportlinkSlideBlueprintKeys),
  context: sportlinkSlideContextSchema,
  display: sportlinkDisplayConfigSchema.default({
    columns: "two",
    showDressingRoom: false,
    showField: true,
    showHomeAway: true,
    showReferee: false
  }),
  name: z.string().trim().min(2).max(120),
  orientation: z.enum(["landscape", "portrait"]),
  templateVersionId: z.string().uuid(),
  themeSelection: themeSelectionSchema,
  title: z.string().trim().min(1).max(160),
  arrival: sportlinkArrivalConfigSchema.optional()
}).strict();

export const createSportlinkSlideBatchSchema = z.object({
  dataSourceId: z.string().uuid(),
  drafts: z.array(sportlinkSlideDraftSchema).min(1).max(25),
  idempotencyKey: z.string().uuid()
}).strict();

export type SportlinkSlideContext = z.infer<typeof sportlinkSlideContextSchema>;
export type SportlinkArrivalConfig = z.infer<typeof sportlinkArrivalConfigSchema>;
export type SportlinkDisplayConfig = z.infer<typeof sportlinkDisplayConfigSchema>;
export type SportlinkArrivalMotionPreset =
  (typeof sportlinkArrivalMotionPresets)[number];
export type SportlinkSlideDraft = z.infer<typeof sportlinkSlideDraftSchema>;

export type SportlinkSlideBlueprint = {
  datasetGroups: readonly string[];
  key: SportlinkSlideBlueprintKey;
  label: string;
  scope: "club" | "pool" | "team";
  slideType:
    | "sport_program"
    | "sport_results"
    | "sport_standing"
    | "sport_visitor_arrivals"
    | "sport_referee_arrivals";
  window: "today" | "next_7_days" | "previous_7_days" | "live_window" | "ranking";
};

export const sportlinkSlideBlueprints = {
  "sportlink.club_schedule_today": { datasetGroups: ["matches"], key: "sportlink.club_schedule_today", label: "Clubprogramma vandaag", scope: "club", slideType: "sport_program", window: "today" },
  "sportlink.club_schedule_next_7_days": { datasetGroups: ["matches"], key: "sportlink.club_schedule_next_7_days", label: "Clubprogramma komende 7 dagen", scope: "club", slideType: "sport_program", window: "next_7_days" },
  "sportlink.club_results_today": { datasetGroups: ["matches"], key: "sportlink.club_results_today", label: "Clubuitslagen vandaag", scope: "club", slideType: "sport_results", window: "today" },
  "sportlink.club_results_previous_7_days": { datasetGroups: ["matches"], key: "sportlink.club_results_previous_7_days", label: "Clubuitslagen afgelopen 7 dagen", scope: "club", slideType: "sport_results", window: "previous_7_days" },
  "sportlink.pool_schedule_next_7_days": { datasetGroups: ["matches", "competitions"], key: "sportlink.pool_schedule_next_7_days", label: "Pouleprogramma komende 7 dagen", scope: "pool", slideType: "sport_program", window: "next_7_days" },
  "sportlink.pool_results_previous_7_days": { datasetGroups: ["matches", "competitions"], key: "sportlink.pool_results_previous_7_days", label: "Pouleuitslagen afgelopen 7 dagen", scope: "pool", slideType: "sport_results", window: "previous_7_days" },
  "sportlink.pool_standings": { datasetGroups: ["competitions"], key: "sportlink.pool_standings", label: "Poulestand", scope: "pool", slideType: "sport_standing", window: "ranking" },
  "sportlink.visitor_arrivals": { datasetGroups: ["matches", "match_details"], key: "sportlink.visitor_arrivals", label: "Aankomst bezoekende teams", scope: "club", slideType: "sport_visitor_arrivals", window: "live_window" },
  "sportlink.referee_arrivals": { datasetGroups: ["matches", "match_details"], key: "sportlink.referee_arrivals", label: "Aankomst scheidsrechters", scope: "club", slideType: "sport_referee_arrivals", window: "live_window" }
} as const satisfies Record<SportlinkSlideBlueprintKey, SportlinkSlideBlueprint>;
