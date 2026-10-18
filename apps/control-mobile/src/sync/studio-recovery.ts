import { z } from "zod";
import { mobileSyncStudioRequestV3Schema, parseStudioDocument, updateSyncStudioDocument, type MobileSyncStudioRequestV3, type MobileSyncStudioResultV3, type StudioDocument } from "@veyocast/studio/mobile-v3";

export const syncStudioRecoverySchema = z.object({
  schemaVersion: z.literal(1), userId: z.string().uuid(), tenantId: z.string().uuid(), projectId: z.string(),
  document: z.unknown().transform((value, context) => {
    try { const document = parseStudioDocument(value); if (!document.syncPresentation) throw Error(); return document; }
    catch { context.addIssue({ code: "custom", message: "Dit herstelconcept bevat geen geldig Sync-document." }); return z.NEVER; }
  }),
  draftRevision: z.number().int().nonnegative(), dirty: z.boolean(),
  fieldInput: z.record(z.string(), z.string().max(4000)).default({}),
  seriesInput: z.object({ name: z.string().max(120), expectedRevision: z.number().int().min(1) }).strict().nullable().default(null),
  pending: mobileSyncStudioRequestV3Schema.nullable(), conflict: z.boolean(),
}).strict();
export type SyncStudioRecovery = z.infer<typeof syncStudioRecoverySchema>;
export type SyncStudioScope = Pick<SyncStudioRecovery, "userId" | "tenantId" | "projectId">;
export const syncStudioRecoveryKey = (scope: SyncStudioScope) => `sync-studio-v3:${scope.userId}:${scope.projectId}`;

export function validateSyncRecovery(scope: SyncStudioScope, value: unknown): SyncStudioRecovery {
  let record: SyncStudioRecovery;
  try { record = syncStudioRecoverySchema.parse(value); }
  catch { throw new Error("Dit lokale concept of de opdracht voldoet niet aan de veilige invoergrenzen. Er is niets verstuurd; controleer de invoer en open Studio opnieuw."); }
  if (record.userId !== scope.userId || record.tenantId !== scope.tenantId || record.projectId !== scope.projectId ||
      record.pending && (record.pending.operation === "create" ? scope.projectId !== "new" : record.pending.projectId !== scope.projectId)) {
    throw new Error("Dit herstelconcept hoort bij een andere sessie, organisatie of ontwerp. Open het ontwerp opnieuw vanuit Studio.");
  }
  return record;
}

export function newSyncRecovery(scope: SyncStudioScope, document: StudioDocument, draftRevision = 0): SyncStudioRecovery {
  return validateSyncRecovery(scope, { schemaVersion: 1, ...scope, document, draftRevision, dirty: false, pending: null, conflict: false });
}

/** A current read never confirms an uncertain command: only its original receipt may do so. */
export function syncRecoveryWithCurrent(record: SyncStudioRecovery, currentRevision: number): SyncStudioRecovery {
  return { ...record, conflict: record.conflict || record.dirty && record.draftRevision !== currentRevision };
}

export function hydrateSyncRecovery(scope: SyncStudioScope, stored: unknown, currentDocument: StudioDocument, currentRevision: number): SyncStudioRecovery {
  const record = validateSyncRecovery(scope, stored);
  return !record.dirty && !record.pending && !record.conflict
    ? { ...newSyncRecovery(scope, currentDocument, currentRevision), seriesInput: record.seriesInput }
    : syncRecoveryWithCurrent(record, currentRevision);
}

export function prepareSyncCreate(record: SyncStudioRecovery, nextKey: () => string): Extract<MobileSyncStudioRequestV3, { operation: "create" }> {
  if (record.pending) {
    if (record.pending.operation !== "create") throw new Error("Dit ontvangstbewijs hoort bij een ander soort opdracht.");
    return record.pending;
  }
  const slide = record.document.syncPresentation!;
  let document: StudioDocument;
  try { document = updateSyncStudioDocument(record.document, { ...slide, name: record.fieldInput.name ?? slide.name, title: record.fieldInput.title ?? slide.title, body: record.fieldInput.body ?? slide.body }); }
  catch { throw new Error("Dit concept is nog niet geldig. Je invoer blijft behouden; controleer de ontwerpnaam, titel en het bericht voordat je bewaart."); }
  return { operation: "create", document, idempotencyKey: nextKey() };
}

export function assertSyncReceipt(command: MobileSyncStudioRequestV3, result: MobileSyncStudioResultV3) {
  if (command.operation !== "create" && command.projectId !== result.projectId) throw new Error("Het ontvangstbewijs hoort niet bij deze opdracht. Bevestig dezelfde opdracht opnieuw.");
  if (result.outcome === "conflict" && command.operation !== "create") return;
  if (
      command.operation === "create" && result.outcome !== "created" ||
      command.operation === "save" && (result.outcome !== "saved" || result.draftRevision <= command.expectedDraftRevision) ||
      command.operation === "render" && (result.outcome !== "queued" || !result.renderJobId || result.draftRevision !== command.expectedDraftRevision) ||
      command.operation === "series" && (result.outcome !== "applied" || !result.series || !result.series.projectIds.includes(result.series.nextProjectId))) {
    throw new Error("De server gaf geen passend ontvangstbewijs. Je opdracht blijft bewaard; bevestig dezelfde opdracht opnieuw.");
  }
}
