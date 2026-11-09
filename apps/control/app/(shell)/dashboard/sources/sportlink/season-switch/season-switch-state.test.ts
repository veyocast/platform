import { describe, expect, it } from "vitest";
import type { SportlinkSeasonInventoryRow, SportlinkSeasonPreview } from "@veyocast/contracts";
import { readSeasonJournal, seasonCommands, seasonPreviewRequest, seasonSelection } from "./season-switch-state";

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const context = (providerTeamId = "new-team", seasonId = "2026/2027", poolId = "league-pool") => ({
  competitionSelectionMode: "pinned" as const, providerTeamId, seasonId, poolId,
  competitionId: "competition", phaseId: "league"
});
const links = { edit: "/dashboard/slides/" + id(1), publish: "/dashboard/planning", restore: null };
const impact = { knownCount: 0, unknown: true, truncated: false, references: [] };
function row(): SportlinkSeasonInventoryRow {
  return {
    resourceKind: "dynamic_slide", resourceId: id(1), name: "Gedeeld teamontwerp", state: "choice_required", reason: "Bevestig een exact team.", canUpdate: true,
    basisVersionId: id(2), draftVersionId: id(3), expectedRevision: 0, oldBindingHash: "a".repeat(64), contextHash: "b".repeat(64), impact, links,
    bindings: [{ fromProviderTeamId: "old-team", currentContext: context("old-team", "2025/2026"), candidatesTruncated: false, candidateCount: 2,
      candidates: [context(), context("new-team", "2026/2027", "cup-pool")].map((value, index) => ({
        candidateId: String(index + 1).repeat(64), context: value, label: "Gelijknamig team", teamName: "Gelijknamig team", competitionName: "Competitie",
        poolName: null, phaseName: null, reason: "explicit_choice", qualifications: { competitionType: null, discipline: null, level: null }
      })) }]
  };
}
function review(resourceId = id(1)): SportlinkSeasonPreview {
  const value = row(), input = seasonPreviewRequest(value, { "old-team": "1".repeat(64) }, false);
  const { clearSelectedMatches, ...fields } = input;
  return { ...fields, schemaVersion: 1, resourceId, oldSelection: { mappings: [{ fromProviderTeamId: "old-team", context: context("old-team", "2025/2026") }] },
    canApply: true, reasons: [], preview: { state: "empty", data: null, message: null }, impact, clearsSelectedMatches: clearSelectedMatches, links };
}

describe("season-switch exact review and recovery", () => {
  it("does not choose a destination by name, first option or kickoff/calendar date", () => {
    expect(() => seasonSelection(row(), {})).toThrow();
    const input = seasonPreviewRequest(row(), { "old-team": "2".repeat(64) }, false);
    expect(input.newSelection.mappings[0]).toMatchObject({ fromProviderTeamId: "old-team", context: { providerTeamId: "new-team", poolId: "cup-pool", seasonId: "2026/2027" } });
    expect(input).not.toHaveProperty("kickoff");
    expect(input).not.toHaveProperty("configuration");
  });

  it("preserves all original team identities and blocks broad or locked resources", () => {
    const value = row(); value.bindings.push({ ...value.bindings[0]!, fromProviderTeamId: "other-old-team", candidates: [{ ...value.bindings[0]!.candidates[0]!, context: context("other-new-team") }] });
    expect(() => seasonSelection(value, { "old-team": "1".repeat(64) })).toThrow();
    expect(seasonSelection(value, { "old-team": "1".repeat(64), "other-old-team": "1".repeat(64) }).mappings.map(item => item.fromProviderTeamId)).toEqual(["old-team", "other-old-team"]);
    expect(() => seasonSelection({ ...value, canUpdate: false, state: "broad_unchanged" }, {})).toThrow();
  });

  it("freezes reviewed revisions, binding hashes and original nonces in stable resource order", () => {
    const commands = seasonCommands([review(id(9)), review(id(1))], [id(10), id(11)], id(12));
    expect(commands.map(item => item.request.resourceId)).toEqual([id(1), id(9)]);
    expect(commands[0]!.request).toMatchObject({ expectedRevision: 0, requestId: id(10), correlationId: id(12), oldBindingHash: "a".repeat(64), contextHash: "b".repeat(64) });
    const journal = { schemaVersion: 1 as const, actorScope: `${id(20)}:${id(21)}`, commands };
    expect(readSeasonJournal(JSON.stringify(journal), journal.actorScope)).toEqual(journal);
    expect(readSeasonJournal(JSON.stringify(journal), journal.actorScope)!.commands[0]!.request).toEqual(commands[0]!.request);
  });

  it("cannot batch an unreviewed resource, duplicate resource or more than twenty-five writes", () => {
    expect(() => seasonCommands([{ ...review(), canApply: false }], [id(10)], id(12))).toThrow();
    expect(() => seasonCommands([review(), review()], [id(10), id(11)], id(12))).toThrow();
    expect(() => seasonCommands(Array.from({ length: 26 }, (_, index) => review(id(100 + index))), Array.from({ length: 26 }, (_, index) => id(200 + index)), id(12))).toThrow();
  });

  it("isolates recovered commands to the original tenant and actor and refuses forged receipt identities", () => {
    const commands = seasonCommands([review()], [id(10)], id(12));
    const journal = { schemaVersion: 1 as const, actorScope: `${id(20)}:${id(21)}`, commands };
    expect(() => readSeasonJournal(JSON.stringify(journal), `${id(22)}:${id(21)}`)).toThrow();
    expect(() => readSeasonJournal(JSON.stringify(journal), `${id(20)}:${id(23)}`)).toThrow();
    const result = { schemaVersion: 1, status: "applied", resourceKind: "dynamic_slide", resourceId: id(1), requestId: id(99), correlationId: id(12), receiptId: id(30), previousVersionId: id(2), draftVersionId: id(3), previousRevision: 0, newRevision: 1, reason: null, links };
    expect(() => readSeasonJournal(JSON.stringify({ ...journal, commands: [{ ...commands[0], result }] }), journal.actorScope)).toThrow();
  });
});
