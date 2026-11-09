import { readFileSync } from "node:fs";
import { sportlinkSeasonInventorySchema, sportlinkSeasonApplyRequestSchema, sportlinkSeasonApplyResultSchema, sportlinkSeasonPreviewSchema, type SportlinkSeasonInventory, type SportlinkSeasonInventoryRow, type SportlinkSeasonPreviewRequest } from "../../packages/contracts/src/sportlink-season-switch";

export const seasonId = (number: number) => `30100000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const seasonActorScope = `${seasonId(1)}:${seasonId(2)}`;
const oldContext = { competitionSelectionMode: "pinned" as const, providerTeamId: "old-team", competitionId: "old-league", poolId: "old-pool", seasonId: "2025/2026", phaseId: "phase-old" };
const targetContext = { ...oldContext, competitionId: "new-league", poolId: "new-pool", seasonId: "2026/2027", phaseId: "phase-league" };

export function seasonInventoryFixture(): SportlinkSeasonInventory {
  const base: SportlinkSeasonInventoryRow = {
    resourceKind: "dynamic_slide", resourceId: seasonId(3), name: "Gedeelde poulestand", state: "available", canUpdate: true,
    reason: "Dezelfde canonieke teamcode heeft één passende competitiecontext.", basisVersionId: seasonId(4), draftVersionId: null,
    expectedRevision: 0, oldBindingHash: "a".repeat(64), contextHash: "b".repeat(64),
    bindings: [{ fromProviderTeamId: "old-team", currentContext: oldContext, candidatesTruncated: false, candidateCount: 1, candidates: [{
      candidateId: "1".repeat(64), context: targetContext, label: "Zelfde team · competitie", teamName: "Eerste team", competitionName: "Competitie", poolName: "Nieuwe poule", phaseName: "Competitie",
      reason: "same_team_identity", qualifications: { competitionType: "league", discipline: "field", level: "senior" }
    }] }],
    impact: { knownCount: 5, unknown: true, truncated: false, references: [
      { kind: "series", id: seasonId(40), name: "Gedeelde reeks", href: `/dashboard/slides/${seasonId(3)}`, state: "draft_playlist", confirmedVersionId: null },
      { kind: "publication", id: seasonId(41), name: "Clubschermpublicatie", href: "/dashboard/planning", state: "immutable_release", confirmedVersionId: null },
      { kind: "zone", id: seasonId(42), name: "Zijzone", href: "/dashboard/planning", state: "configured_zone", confirmedVersionId: null },
      { kind: "schedule", id: seasonId(43), name: "Terugkerende zaterdag", href: "/dashboard/planning", state: "recurring_schedule", confirmedVersionId: null }
      ,{ kind: "screen", id: seasonId(44), name: "Eerder gemeld clubscherm", href: `/dashboard/screens/${seasonId(44)}`, state: "confirmed_publication", confirmedVersionId: seasonId(4) }
    ] }, links: { edit: `/dashboard/slides/${seasonId(3)}/edit`, publish: `/dashboard/playlists/${seasonId(40)}/publish`, restore: `/dashboard/publications/${seasonId(41)}` }
  };
  const ambiguous = structuredClone(base);
  ambiguous.resourceId = seasonId(5); ambiguous.name = "Beker en competitie"; ambiguous.state = "choice_required";
  ambiguous.reason = "Twee geldige contexten; een gelijke naam bepaalt geen identiteit.";
  ambiguous.bindings[0]!.candidateCount = 2;
  ambiguous.bindings[0]!.candidates.push({ ...ambiguous.bindings[0]!.candidates[0]!, candidateId: "2".repeat(64), context: { ...targetContext, competitionId: "cup", poolId: "cup-pool", phaseId: "cup-phase" }, label: "Zelfde team · beker", reason: "explicit_choice" });
  const broad = structuredClone(base);
  broad.resourceId = seasonId(6); broad.name = "Alle teams en contexten"; broad.state = "broad_unchanged"; broad.canUpdate = false;
  broad.reason = "De bewuste brede selectie bevat geen seizoensbinding en blijft ongewijzigd."; broad.bindings = [];
  const historical = structuredClone(base);
  historical.resourceId = seasonId(7); historical.name = "Bevroren oude bekerdag"; historical.state = "locked"; historical.canUpdate = false;
  historical.reason = "Deze historische of actieve context wordt niet bijgewerkt.";
  return {
    schemaVersion: 1, connection: { id: seasonId(10), sourceId: seasonId(11), name: "Gecontroleerde testvereniging", timeZone: "Europe/Amsterdam" },
    seasons: [{ id: "2025/2026", label: "2025/2026" }, { id: "2026/2027", label: "2026/2027" }], targetSeasonId: "2026/2027",
    sourceHealth: { state: "ready", matchesLastSuccessAt: "2026-11-09T11:00:00Z", competitionsLastSuccessAt: "2026-11-09T10:59:00Z", observedThrough: null, coverageKnown: false, reasons: [] },
    rows: [base, ambiguous, broad, historical], nextCursor: null, totalCount: 4, integration: { matchdayRunbooks: "unavailable" }
  };
}

export function seasonPreviewFixture(input: SportlinkSeasonPreviewRequest) {
  const row = seasonInventoryFixture().rows.find(item => item.resourceId === input.resourceId)!;
  const { clearSelectedMatches, ...fields } = input;
  return sportlinkSeasonPreviewSchema.parse({ ...fields, schemaVersion: 1, oldSelection: { mappings: row.bindings.map(binding => ({ fromProviderTeamId: binding.fromProviderTeamId, context: binding.currentContext })) },
    canApply: true, reasons: ["De exacte nieuwe context is opnieuw op de server gecontroleerd."], preview: { state: "empty", data: null, message: "Deze geldige selectie heeft nog geen wedstrijden." }, impact: row.impact, clearsSelectedMatches: clearSelectedMatches, links: row.links });
}

/** Isolated rollback-only SQL capture, synthetic tenants; this is not hosted data. */
export function seasonDatabaseFixture() {
  const raw = JSON.parse(readFileSync("tests/fixtures/s301-season-rpc.json", "utf8"));
  return {
    inventory: sportlinkSeasonInventorySchema.parse(raw.inventory), preview: sportlinkSeasonPreviewSchema.parse(raw.preview),
    command: sportlinkSeasonApplyRequestSchema.parse(raw.command), applied: sportlinkSeasonApplyResultSchema.parse(raw.applied),
    replay: sportlinkSeasonApplyResultSchema.parse(raw.replay), conflict: sportlinkSeasonApplyResultSchema.parse(raw.conflict)
  };
}
