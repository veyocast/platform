import {goalOverlayConfigurationSchema} from "@veyocast/contracts";
import {parseLedScoresCanvasScenePair,parseLedScoresOverlayAssets,type LedScoresPlayerViewModel} from "./ledscores-match-experience";
import type {ActiveLedScoresGoal} from "../_components/ledscores-goal-overlay";
type OverlayDesign=ActiveLedScoresGoal["design"];
export function parseGoalMessage(value: unknown) {
  if (!isRecord(value) || !isRecord(value.payload) || !Array.isArray(value.assets)) return null;
  const payload = value.payload;
  const deliveryId = safeUuid(value.id);
  const executeAt = safeTimestamp(value.executeAt);
  const expiresAt = safeTimestamp(value.expiresAt);
  const serverTime = safeTimestamp(value.serverTime);
  const eventId = safeUuid(payload.eventId);
  const scoringSide: ActiveLedScoresGoal["scoringSide"] | null =
    payload.scoringSide === "own" || payload.scoringSide === "opponent" || payload.scoringSide === "unknown"
      ? payload.scoringSide
      : null;
  const design = parseDesign(payload.design);
  const durationMs = boundedInteger(payload.durationMs, 2_000, 30_000);
  const homeScore = boundedInteger(payload.homeScore, 0, 999);
  const awayScore = boundedInteger(payload.awayScore, 0, 999);
  const previousHomeScore = boundedInteger(payload.previousHomeScore, 0, 999);
  const previousAwayScore = boundedInteger(payload.previousAwayScore, 0, 999);
  const player = parseGoalPlayer(payload.player ?? payload.scorer);
  if (!deliveryId || !executeAt || !expiresAt || !serverTime || !eventId || !scoringSide || !design || durationMs === null || homeScore === null || awayScore === null || previousHomeScore === null || previousAwayScore === null) return null;
  const assets = parseLedScoresOverlayAssets(value.assets);
  return {
    executeAt,
    expiresAt,
    goal: {
      alertVersionId: safeOptionalUuid(value.alertVersionId),
      screenOrientation: null as "portrait" | "landscape" | null,
      assets,
      competition: safeText(payload.competition, 160),
      matchName: safeText(payload.matchName, 240),
      round: safeText(payload.round, 80),
      venue: safeText(payload.venue, 160),
      configuration: goalOverlayConfigurationSchema.safeParse(payload.goalOverlay).success ? goalOverlayConfigurationSchema.parse(payload.goalOverlay) : null,
      homeLogo: safeOptionalUuid(payload.homeLogo),
      awayLogo: safeOptionalUuid(payload.awayLogo),
      awayScore,
      awayTeam: safeText(payload.awayTeam, 160) ?? "Uitteam",
      deliveryId,
      design,
      durationMs,
      eventId,
      eventKind: payload.eventKind === "synthetic_test" ? "synthetic_test" as const : "live" as const,
      homeScore,
      homeTeam: safeText(payload.homeTeam, 160) ?? "Thuisteam",
      kind: "goal" as const,
      logoMediaAssetId: safeOptionalUuid(payload.logoMediaAssetId),
      matchClock: safeText(payload.matchClock, 40),
      mediaAssetId: safeOptionalUuid(payload.mediaAssetId),
      previousAwayScore,
      previousHomeScore,
      player,
      scene: parseLedScoresCanvasScenePair(payload.scene, assets),
      scorerName: player?.name ?? safeText(payload.scorerName, 160),
      scoringSide,
      soundMediaAssetId: safeOptionalUuid(payload.soundMediaAssetId),
      soundVolume: boundedInteger(payload.soundVolume, 0, 100) ?? 70,
      sponsorMediaAssetId: safeOptionalUuid(payload.sponsorMediaAssetId),
      underlayPolicy: payload.underlayPolicy === "pause" ? "pause" as const : "continue" as const
    },
    serverTime
  };
}

function parseGoalPlayer(value: unknown): LedScoresPlayerViewModel | null { if (!isRecord(value)) return null; const name = safeText(value.name, 160); if (!name) return null; const rawNumber = typeof value.number === "number" ? String(value.number) : value.number; return { id: safeText(value.id ?? value.providerPlayerId, 200), name, number: safeText(rawNumber, 16), photoUrl: safeWebUrl(value.photoUrl) }; }
function safeWebUrl(value: unknown) { return typeof value === "string" && value.length <= 2_000 && /^https?:\/\//.test(value) ? value : null; }
function parseDesign(value: unknown): OverlayDesign | null { if (!isRecord(value)) return null; const headline = safeText(value.headline, 80); const secondaryText = safeText(value.secondaryText, 160) ?? ""; const scorerFallback = safeText(value.scorerFallback, 120) ?? "Doelpunt!"; const palette = ["electric-orange", "ink-black", "signal-red", "white"].includes(String(value.palette)) ? String(value.palette) as OverlayDesign["palette"] : null; const animation = ["impact", "pulse", "slide", "none"].includes(String(value.animation)) ? String(value.animation) as OverlayDesign["animation"] : null; const logoScale = ["small", "medium", "large"].includes(String(value.logoScale)) ? String(value.logoScale) as OverlayDesign["logoScale"] : "medium"; if (!headline || !palette || !animation) return null; return { animation, headline, logoPosition: value.logoPosition === "center" ? "center" : "left", logoScale, palette, scorerFallback, secondaryText, showClock: value.showClock === true, showPreviousScore: value.showPreviousScore === true, showScorer: value.showScorer !== false, typography: value.typography === "body" ? "body" : "display" }; }
function safeUuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
function safeOptionalUuid(value: unknown) { return value === null || value === undefined || value === "" ? null : safeUuid(value); }
function safeTimestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function safeText(value: unknown, maximum: number) { return typeof value === "string" && value.trim() && value.length <= maximum ? value.trim() : null; }
function boundedInteger(value: unknown, minimum: number, maximum: number) { const number = Number(value); return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
