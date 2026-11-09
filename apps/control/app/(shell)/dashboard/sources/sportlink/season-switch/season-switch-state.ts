import {
  sportlinkSeasonApplyRequestSchema, sportlinkSeasonApplyResultSchema,
  sportlinkSeasonSelectionSchema,
  type SportlinkSeasonApplyRequest, type SportlinkSeasonApplyResult,
  type SportlinkSeasonInventoryRow, type SportlinkSeasonPreview, type SportlinkSeasonPreviewRequest
} from "@veyocast/contracts";

export const seasonSwitchBatchLimit = 25;
export const seasonResourceKey = (row: { resourceKind: string; resourceId: string }) => `${row.resourceKind}:${row.resourceId}`;

export function seasonSelection(row: SportlinkSeasonInventoryRow, choices: Record<string, string>) {
  if (!row.canUpdate || row.bindings.length === 0) throw Error("Deze rij kan niet worden bijgewerkt.");
  const mappings = row.bindings.map(binding => {
    const candidate = binding.candidates.find(item => item.candidateId === choices[binding.fromProviderTeamId]);
    if (!candidate) throw Error("Kies voor ieder oorspronkelijk team een gecontroleerde nieuwe context.");
    return { fromProviderTeamId: binding.fromProviderTeamId, context: candidate.context };
  });
  return sportlinkSeasonSelectionSchema.parse({ mappings });
}

export function seasonPreviewRequest(row: SportlinkSeasonInventoryRow, choices: Record<string, string>, clearSelectedMatches: boolean): SportlinkSeasonPreviewRequest {
  return {
    resourceKind: row.resourceKind, resourceId: row.resourceId, basisVersionId: row.basisVersionId,
    expectedRevision: row.expectedRevision, oldBindingHash: row.oldBindingHash, contextHash: row.contextHash,
    newSelection: seasonSelection(row, choices), clearSelectedMatches
  };
}

export type SeasonCommand = { request: SportlinkSeasonApplyRequest; result: SportlinkSeasonApplyResult | null };
export type SeasonJournal = { schemaVersion: 1; actorScope: string; commands: SeasonCommand[] };

/** Freeze exact reviewed bodies before the first write. Retries keep these nonces. */
export function seasonCommands(reviews: SportlinkSeasonPreview[], requestIds: string[], correlationId: string): SeasonCommand[] {
  if (!reviews.length || reviews.length > seasonSwitchBatchLimit || requestIds.length !== reviews.length) throw Error("Kies één tot vijfentwintig gecontroleerde rijen.");
  const sorted = [...reviews].sort((a, b) => seasonResourceKey(a).localeCompare(seasonResourceKey(b), "en"));
  if (new Set(sorted.map(seasonResourceKey)).size !== sorted.length) throw Error("Een object mag maar één keer worden bevestigd.");
  return sorted.map((review, index) => {
    if (!review.canApply) throw Error("Controleer eerst alle gekozen nieuwe koppelingen.");
    const request = sportlinkSeasonApplyRequestSchema.parse({
      resourceKind: review.resourceKind, resourceId: review.resourceId, basisVersionId: review.basisVersionId,
      expectedRevision: review.expectedRevision, oldBindingHash: review.oldBindingHash, contextHash: review.contextHash,
      newSelection: review.newSelection, clearSelectedMatches: review.clearsSelectedMatches,
      requestId: requestIds[index], correlationId
    });
    return { request, result: null };
  });
}

export function readSeasonJournal(raw: string | null, actorScope: string): SeasonJournal | null {
  if (!raw) return null;
  if (raw.length > 5_000_000) throw Error("Het lokale opdrachtbewijs is te groot.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Ongeldig opdrachtbewijs.");
  const journal = value as Record<string, unknown>;
  if (Object.keys(journal).sort().join(",") !== "actorScope,commands,schemaVersion" || journal.schemaVersion !== 1 || journal.actorScope !== actorScope
    || !Array.isArray(journal.commands) || !journal.commands.length || journal.commands.length > seasonSwitchBatchLimit) throw Error("Het opdrachtbewijs hoort niet bij deze sessie.");
  const commands = journal.commands.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).sort().join(",") !== "request,result") throw Error("Ongeldig opdrachtbewijs.");
    const item = entry as Record<string, unknown>;
    const request = sportlinkSeasonApplyRequestSchema.parse(item.request);
    const result = item.result === null ? null : sportlinkSeasonApplyResultSchema.parse(item.result);
    if (result && (result.requestId !== request.requestId || result.correlationId !== request.correlationId || seasonResourceKey(result) !== seasonResourceKey(request))) throw Error("Het ontvangstbewijs hoort bij een andere opdracht.");
    return { request, result };
  });
  if (new Set(commands.map(item => seasonResourceKey(item.request))).size !== commands.length
    || new Set(commands.map(item => item.request.requestId)).size !== commands.length
    || new Set(commands.map(item => item.request.correlationId)).size !== 1) throw Error("Het opdrachtbewijs bevat dubbele of gemengde opdrachten.");
  return { schemaVersion: 1, actorScope, commands };
}
