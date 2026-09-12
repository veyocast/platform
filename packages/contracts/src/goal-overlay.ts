import { z } from "zod";
import { themeModePolicySchema } from "./theme-engine";

export const goalTemplateVariables = ["team", "scorer", "home_team", "away_team", "home_score", "away_score", "minute"] as const;
export function validGoalTemplate(value: string) {
  const stripped = value.replace(/\{([a-z_]+)\}/g, (match, key: string) =>
    (goalTemplateVariables as readonly string[]).includes(key) ? "" : match);
  return !/[{}<>]/.test(stripped) && ![...stripped].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
const template = (max: number) => z.string().max(max).refine(validGoalTemplate, "Gebruik alleen de beschikbare variabelen tussen accolades.");
const color = z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null);
export const goalOverlayConfigurationSchema = z.object({
  schemaVersion: z.literal(2),
  themeMode: z.enum(["auto", "light", "dark"]).default("auto"),
  headlineTemplate: template(80).min(1).default("GOAL!"),
  subtitleTemplate: template(160).default(""),
  goalTextTemplate: template(160).default(""),
  showScorer: z.boolean().default(true),
  showPlayerPhoto: z.boolean().default(true),
  showShirtNumber: z.boolean().default(true),
  showMinute: z.boolean().default(true),
  showTeamNames: z.boolean().default(true),
  showTeamLogos: z.boolean().default(true),
  showCompetition: z.boolean().default(false),
  showMatchName: z.boolean().default(false),
  showRound: z.boolean().default(false),
  showVenue: z.boolean().default(false),
  lightOuterColor: color,
  darkOuterColor: color,
  lightCardColor: color,
  darkCardColor: color,
  lightTextColor: color,
  darkTextColor: color,
  accentTextColor: color,
  font: z.enum(["display", "body"]).default("display"),
  layout: z.enum(["centered", "player-focus"]).default("centered"),
  radius: z.number().int().min(0).max(64).default(28),
  spacing: z.enum(["compact", "comfortable", "generous"]).default("comfortable"),
  shadow: z.boolean().default(true),
  logoSize: z.enum(["small", "medium", "large"]).default("medium"),
  photoSize: z.enum(["small", "medium", "large"]).default("medium"),
  introEnabled: z.boolean().default(false),
  introLandscapeMediaId: z.string().uuid().nullable().default(null),
  introPortraitMediaId: z.string().uuid().nullable().default(null),
  // Keep historical v2 wire payloads unchanged for Players updating in place.
  // Missing means false; parsing must not inject a new key into old versions.
  introAllowOrientationFallback: z.boolean().optional(),
  overlayDurationMs: z.number().int().min(2000).max(30000).default(7000),
  enterAnimation: z.enum(["fade", "rise", "none"]).default("rise"),
  exitAnimation: z.enum(["fade", "none"]).default("fade"),
  transitionDurationMs: z.number().int().min(0).max(1500).default(350),
  defaults: z.object({
    primary: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
    darkSurface: z.string().regex(/^(?:#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0?(?:\.\d+)?|1(?:\.0+)?))?\s*\))$/i).nullable().default(null),
    modePolicy: themeModePolicySchema,
    timezone: z.string().min(1).max(80)
  }).optional()
}).strict();
export type GoalOverlayConfiguration = z.infer<typeof goalOverlayConfigurationSchema>;
export const defaultGoalOverlayConfiguration = goalOverlayConfigurationSchema.parse({ schemaVersion: 2 });

export type GoalOverlayEvent = {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoreboardSide: "home" | "away";
  scorer: string | null;
  playerPhoto: string | null;
  shirtNumber: string | null;
  minute: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  teamPrimary?: string | null;
  competition?: string | null;
  matchName?: string | null;
  round?: string | null;
  venue?: string | null;
  test: boolean;
};

/** Compatibility helper; all selection rules live in resolveGoalIntroAsset. */
export function chooseGoalIntro(config: GoalOverlayConfiguration, orientation: "landscape" | "portrait") {
  return resolveGoalIntroAsset({ configuration: config, screenOrientation: orientation, width: 0, height: 0,
    assets: [config.introLandscapeMediaId, config.introPortraitMediaId].flatMap((id) =>
      id ? [{ mediaAssetId: id, mimeType: "video/mp4" }] : []) }).assetId;
}

/** Pure and self-contained: the Static LG bundle embeds this exact selector. */
export function resolveGoalIntroAsset(input: {
  configuration: Pick<GoalOverlayConfiguration, "introEnabled" | "introLandscapeMediaId" | "introPortraitMediaId" | "introAllowOrientationFallback">;
  screenOrientation?: string | null;
  width: number;
  height: number;
  assets: readonly { mediaAssetId: string; mimeType: string }[];
  canPlayType?: (type: string) => string;
}) {
  const orientation = input.screenOrientation === "portrait" || input.screenOrientation === "9:16" || input.screenOrientation === "vertical"
    ? "portrait" : input.screenOrientation === "landscape" || input.screenOrientation === "16:9"
      ? "landscape" : input.height > input.width ? "portrait" : "landscape";
  const config = input.configuration;
  const primary = orientation === "portrait" ? config.introPortraitMediaId : config.introLandscapeMediaId;
  const fallback = orientation === "portrait" ? config.introLandscapeMediaId : config.introPortraitMediaId;
  const id = config.introEnabled ? primary || (config.introAllowOrientationFallback === true ? fallback : null) : null;
  const asset = input.assets.find(function (candidate) { return candidate.mediaAssetId === id; });
  const code = !config.introEnabled ? null : !id || !asset ? "GOAL_VIDEO_ASSET_MISSING"
    : asset.mimeType !== "video/mp4" || (input.canPlayType && !input.canPlayType('video/mp4; codecs="avc1.4D4028"'))
      ? "GOAL_VIDEO_UNSUPPORTED_FORMAT" : null;
  return { orientation: orientation as "portrait" | "landscape", assetId: code ? null : id,
    requestedAssetId: id, mimeType: asset ? asset.mimeType : null, code, fallback: Boolean(id && id !== primary) };
}

export type GoalPlaybackPhase = "IDLE" | "GOAL_INTRO_LOADING" | "GOAL_INTRO_PLAYING" | "GOAL_OVERLAY_ENTERING" | "GOAL_OVERLAY_VISIBLE" | "GOAL_OVERLAY_EXITING" | "RESUMING_PLAYLIST";
export type GoalPlaybackAction = "start_intro" | "intro_playing" | "intro_ended" | "intro_failed" | "start_overlay" | "entered" | "duration_elapsed" | "exited" | "resumed";
export function transitionGoalPlayback(phase: GoalPlaybackPhase, action: GoalPlaybackAction): GoalPlaybackPhase {
  if (phase === "IDLE" && action === "start_intro") return "GOAL_INTRO_LOADING";
  if (phase === "GOAL_INTRO_LOADING" && action === "intro_playing") return "GOAL_INTRO_PLAYING";
  if ((phase === "GOAL_INTRO_LOADING" || phase === "GOAL_INTRO_PLAYING") && (action === "intro_failed" || action === "intro_ended")) return "GOAL_OVERLAY_ENTERING";
  if (phase === "IDLE" && action === "start_overlay") return "GOAL_OVERLAY_ENTERING";
  if (phase === "GOAL_OVERLAY_ENTERING" && action === "entered") return "GOAL_OVERLAY_VISIBLE";
  if (phase === "GOAL_OVERLAY_VISIBLE" && action === "duration_elapsed") return "GOAL_OVERLAY_EXITING";
  if (phase === "GOAL_OVERLAY_EXITING" && action === "exited") return "RESUMING_PLAYLIST";
  if (phase === "RESUMING_PLAYLIST" && action === "resumed") return "IDLE";
  return phase;
}

export const goalOverlayTeamSelectionSchema = z.array(z.object({ connectionId: z.string().uuid(), clubId: z.string().min(1).max(120), teamKey: z.string().min(1).max(160) }).strict()).min(1).max(250);
export const goalOverlayActionIdentitySchema = z.object({ alertId: z.string().uuid().nullable(), revision: z.coerce.number().int().min(0) });
export const goalOverlayGroupSelectionSchema = z.array(z.string().uuid()).min(1).max(50);
export const goalOverlayStatusSchema = z.enum(["paused", "published"]);
export const goalOverlayTestInputSchema = z.object({ group: z.string().uuid(), side: z.enum(["home", "away"]), home: z.coerce.number().int().min(0).max(999), away: z.coerce.number().int().min(0).max(999), scorerId: z.string().uuid().nullable(), scorerName: z.string().max(160), minute: z.string().max(20) });
