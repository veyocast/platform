import { createDefaultLedScoresCanvasExperience, ledScoresCanvasMomentKeys, sitesPresentationSchema, type LedScoresCanvasExperience, type LedScoresCanvasMomentKey, type SitesDynamicConfiguration, type SitesPresentation } from "@veyocast/contracts";
import { createSitesSourceDesign } from "../sportlink/new/sites-source-design";
export const sitesLedMomentLabels: Record<LedScoresCanvasMomentKey, string> = { goalOwn: "Doelpunt eigen team", goalOpponent: "Tegendoelpunt", goalUnknown: "Doelpunt", lineupHome: "Opstelling thuis", lineupAway: "Opstelling uit", matchStart: "Start wedstrijd", halfTime: "Rust", matchEnd: "Einde wedstrijd" };
export type SitesLedStoredState = { home: { name: string; score: number }; away: { name: string; score: number }; sourceUpdatedAt: string; clockSeconds: number | null };
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
/** Read only the normalized database fields needed for a preview; reject invalid score state. */
export function parseSitesLedStoredState(value: unknown): SitesLedStoredState | null {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.home) || !record(value.away)) return null;
  const team = (item: Record<string, unknown>) => typeof item.name === "string" && item.name.length > 0 && item.name.length <= 240 && typeof item.score === "number" && Number.isSafeInteger(item.score) && item.score >= 0 && item.score <= 999 ? { name: item.name, score: item.score } : null;
  const home = team(value.home), away = team(value.away);
  if (!home || !away || typeof value.sourceUpdatedAt !== "string" || !Number.isFinite(Date.parse(value.sourceUpdatedAt))) return null;
  const clockSeconds = record(value.clock) && typeof value.clock.anchorSeconds === "number" && Number.isInteger(value.clock.anchorSeconds) && value.clock.anchorSeconds >= 0 && value.clock.anchorSeconds <= 86_400 ? value.clock.anchorSeconds : null;
  return { home, away, clockSeconds, sourceUpdatedAt: value.sourceUpdatedAt };
}
export function createSitesLedSceneDesign(moment: LedScoresCanvasMomentKey, orientation: "landscape" | "portrait", durationMs = 8000): SitesDynamicConfiguration {
  const ledMoment = moment.startsWith("goal") ? "goal" : moment.startsWith("lineup") ? "lineup" : moment === "halfTime" ? "half" : moment === "matchEnd" ? "end" : "start";
  return { ...createSitesSourceDesign("led-scores", moment === "goalOwn" ? "GOALLL!" : sitesLedMomentLabels[moment], orientation), seconds: Math.max(3, Math.min(120, Math.floor(durationMs / 1000))), ledMoment, ledSide: moment === "goalOwn" ? "own" : moment === "goalOpponent" ? "opponent" : "unknown" };
}
export function createSitesLedCanvasExperience(durationMs = 8000): LedScoresCanvasExperience {
  const experience = createDefaultLedScoresCanvasExperience();
  for (const moment of ledScoresCanvasMomentKeys) for (const orientation of ["landscape", "portrait"] as const) experience.scenes[moment][orientation].sitesConfiguration = createSitesLedSceneDesign(moment, orientation, durationMs);
  return experience;
}
export function buildSitesLedStoredPreview(configuration: SitesDynamicConfiguration, state: SitesLedStoredState | null): SitesPresentation | null {
  if (!state) return null;
  const lineup = configuration.ledMoment === "lineup";
  const clock = state.clockSeconds === null ? undefined : `${Math.floor(state.clockSeconds / 60)}:${String(state.clockSeconds % 60).padStart(2, "0")}`;
  const parsed = sitesPresentationSchema.safeParse({ kind: "dynamic", configuration, content: { kind: lineup ? "lineup" : configuration.ledMoment === "goal" ? "goal" : "score", title: configuration.title, subtitle: configuration.subtitle, background: configuration.background,
    rows: lineup ? [] : [{ id: "home", primary: state.home.name, value: String(state.home.score) }, { id: "away", primary: state.away.name, value: String(state.away.score) }], match: { home: state.home.name, away: state.away.name, homeScore: String(state.home.score), awayScore: String(state.away.score), ...(clock ? { clock } : {}) } } });
  return parsed.success ? parsed.data : null;
}
