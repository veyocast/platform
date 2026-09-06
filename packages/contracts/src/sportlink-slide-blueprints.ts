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
export const sportlinkTeamSelectionModes = ["all", "selected"] as const;

export const sportlinkClubAggregateBlueprintKeys = [
  "sportlink.club_schedule_today",
  "sportlink.club_schedule_next_7_days",
  "sportlink.club_results_today",
  "sportlink.club_results_previous_7_days"
] as const satisfies readonly SportlinkSlideBlueprintKey[];

export const sportlinkArrivalMotionPresets = [
  "auto",
  "aurora-rise",
  "spotlight-bloom",
  "kinetic-split",
  "prism-swipe",
  "grand-flip"
] as const;

export const sportlinkArrivalWindowMaxMinutes = 42 * 24 * 60;
export const sportlinkSlideBatchMaxDrafts = 25;
export const sportlinkSlideTeamContextsMax = 500;

export const sportlinkSlideContextSchema = z.object({
  competitionId: z.string().trim().min(1).max(200).nullable(),
  competitionSelectionMode: z.enum(sportlinkCompetitionSelectionModes),
  phaseId: z.string().trim().min(1).max(200).nullable(),
  poolId: z.string().trim().min(1).max(200).nullable(),
  providerTeamId: z.string().trim().min(1).max(200),
  seasonId: z.string().trim().min(1).max(80).nullable()
}).strict().superRefine((context, refinement) => {
  if (context.competitionSelectionMode !== "auto_current") return;
  for (const key of ["competitionId", "phaseId", "poolId", "seasonId"] as const) {
    if (context[key] !== null) {
      refinement.addIssue({
        code: "custom",
        message: "Actuele competitie mag geen vastgezette competitiecontext bevatten.",
        path: [key]
      });
    }
  }
});

export const sportlinkSlideTeamContextsSchema = z.array(sportlinkSlideContextSchema)
  .min(1)
  .max(sportlinkSlideTeamContextsMax)
  .superRefine((contexts, refinement) => {
    const teamIds = new Set<string>();
    for (const [index, context] of contexts.entries()) {
      if (teamIds.has(context.providerTeamId)) {
        refinement.addIssue({
          code: "custom",
          message: "Ieder team mag maar één keer in de selectie staan.",
          path: [index, "providerTeamId"]
        });
      }
      teamIds.add(context.providerTeamId);
    }
  });

export const sportlinkSlideTeamSelectionSchema = z.object({
  mode: z.enum(sportlinkTeamSelectionModes),
  teamContexts: z.array(sportlinkSlideContextSchema)
    .max(sportlinkSlideTeamContextsMax)
}).strict().superRefine((selection, refinement) => {
  if (selection.mode === "selected" && selection.teamContexts.length === 0) {
    refinement.addIssue({
      code: "custom",
      message: "Kies minimaal één team of activeer Alle teams.",
      path: ["teamContexts"]
    });
  }
  if (selection.mode === "all") {
    selection.teamContexts.forEach((context, index) => {
      if (context.competitionSelectionMode !== "pinned") {
        refinement.addIssue({
          code: "custom",
          message: "Alle teams bewaart alleen expliciete competitie-overrides.",
          path: ["teamContexts", index, "competitionSelectionMode"]
        });
      }
    });
  }
  const teamIds = new Set<string>();
  for (const [index, context] of selection.teamContexts.entries()) {
    if (teamIds.has(context.providerTeamId)) {
      refinement.addIssue({
        code: "custom",
        message: "Ieder team mag maar één keer in de selectie staan.",
        path: ["teamContexts", index, "providerTeamId"]
      });
    }
    teamIds.add(context.providerTeamId);
  }
});

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
  columns: z.enum(["one", "two"]).default("one"),
  showDressingRoom: z.boolean().default(false),
  showField: z.boolean().default(true),
  showHomeAway: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  showReferee: z.boolean().default(false)
}).strict();

export const sportlinkSlideDraftSchema = z.object({
  blueprintKey: z.enum(sportlinkSlideBlueprintKeys),
  context: sportlinkSlideContextSchema,
  display: sportlinkDisplayConfigSchema.default({
    columns: "one",
    showDressingRoom: false,
    showField: true,
    showHomeAway: true,
    showLogo: true,
    showReferee: false
  }),
  name: z.string().trim().min(2).max(120),
  orientation: z.enum(["landscape", "portrait"]),
  templateVersionId: z.string().uuid(),
  themeSelection: themeSelectionSchema,
  title: z.string().trim().min(1).max(160),
  arrival: sportlinkArrivalConfigSchema.optional(),
  teamContexts: sportlinkSlideTeamContextsSchema.optional(),
  teamSelection: sportlinkSlideTeamSelectionSchema.optional()
}).strict().superRefine((draft, refinement) => {
  const arrival = [
    "sportlink.visitor_arrivals",
    "sportlink.referee_arrivals"
  ].includes(draft.blueprintKey);
  const clubAggregate = sportlinkClubAggregateBlueprintKeys.includes(
    draft.blueprintKey as (typeof sportlinkClubAggregateBlueprintKeys)[number]
  );
  if (draft.teamContexts && !arrival) {
    refinement.addIssue({
      code: "custom",
      message: "Een teamselectie met meerdere contexten is alleen geldig voor welkomstslides.",
      path: ["teamContexts"]
    });
  }
  if (draft.teamSelection && !clubAggregate) {
    refinement.addIssue({
      code: "custom",
      message: "Een clubbrede teamfilter is alleen geldig voor clubprogramma en clubuitslagen.",
      path: ["teamSelection"]
    });
  }
  const primary = draft.teamContexts?.[0] ??
    draft.teamSelection?.teamContexts[0];
  if (primary && (
    primary.competitionId !== draft.context.competitionId ||
    primary.competitionSelectionMode !== draft.context.competitionSelectionMode ||
    primary.phaseId !== draft.context.phaseId ||
    primary.poolId !== draft.context.poolId ||
    primary.providerTeamId !== draft.context.providerTeamId ||
    primary.seasonId !== draft.context.seasonId
  )) {
    refinement.addIssue({
      code: "custom",
      message: "De primaire context moet gelijk zijn aan het eerste geselecteerde team.",
      path: ["context"]
    });
  }
});

export const createSportlinkSlideBatchSchema = z.object({
  dataSourceId: z.string().uuid(),
  drafts: z.array(sportlinkSlideDraftSchema).min(1).max(sportlinkSlideBatchMaxDrafts),
  idempotencyKey: z.string().uuid()
}).strict().superRefine((command, refinement) => {
  command.drafts.forEach((draft, index) => {
    if (
      ["sportlink.visitor_arrivals", "sportlink.referee_arrivals"].includes(
        draft.blueprintKey
      ) && !draft.teamContexts
    ) {
      refinement.addIssue({
        code: "custom",
        message: "Nieuwe welkomstslides vereisen een expliciete teamselectie.",
        path: ["drafts", index, "teamContexts"]
      });
    }
  });
});

export type SportlinkSlideContext = z.infer<typeof sportlinkSlideContextSchema>;
export type SportlinkSlideTeamContexts = z.infer<typeof sportlinkSlideTeamContextsSchema>;
export type SportlinkSlideTeamSelection = z.infer<
  typeof sportlinkSlideTeamSelectionSchema
>;
export type SportlinkArrivalConfig = z.infer<typeof sportlinkArrivalConfigSchema>;
export type SportlinkDisplayConfig = z.infer<typeof sportlinkDisplayConfigSchema>;
export type SportlinkTeamSelectionMode = (typeof sportlinkTeamSelectionModes)[number];
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
