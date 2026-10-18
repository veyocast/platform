import { describe, expect, it, vi } from "vitest";
import { createSyncStudioStarter, updateSyncStudioDocument, type MobileSyncStudioRequestV3 } from "@veyocast/studio/mobile-v3";
import { assertSyncReceipt, hydrateSyncRecovery, newSyncRecovery, prepareSyncCreate, syncRecoveryWithCurrent, validateSyncRecovery } from "./studio-recovery";

const scope = { userId: "10000000-0000-4000-8000-000000000001", tenantId: "20000000-0000-4000-8000-000000000001", projectId: "30000000-0000-4000-8000-000000000001" };
const key = "40000000-0000-4000-8000-000000000001";
const original = createSyncStudioStarter({ family: "club-story", tenantName: "Mijn vereniging", orientation: "portrait", theme: "onzetrots-tv" });

describe("native Sync document and uncertain command continuity", () => {
  it("reuses an uncertain create nonce, then creates a second design with a fresh nonce after the editor reset", () => {
    const creationScope = { ...scope, projectId: "new" };
    const keys = vi.fn().mockReturnValueOnce(key).mockReturnValueOnce(scope.projectId);
    const first = prepareSyncCreate(newSyncRecovery(creationScope, original), keys);
    const pending = { ...newSyncRecovery(creationScope, original), pending: first };
    expect(prepareSyncCreate(pending, keys)).toBe(first);
    expect(keys).toHaveBeenCalledTimes(1);
    assertSyncReceipt(first, { outcome: "created", projectId: scope.projectId, draftRevision: 0, renderJobId: null, series: null });
    const reset = newSyncRecovery(creationScope, original);
    const second = prepareSyncCreate(reset, keys);
    expect(reset.pending).toBeNull();
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(keys).toHaveBeenCalledTimes(2);
  });
  it("restores the full Source document, style, orientation, metadata and exact save body after serialization", () => {
    const document = updateSyncStudioDocument(original, { ...original.syncPresentation!, body: "Eigen nieuws", style: { ...original.syncPresentation!.style, motion: "dynamisch", scale: 117 } }, 9);
    const command: MobileSyncStudioRequestV3 = { operation: "save", document, expectedDraftRevision: 7, projectId: scope.projectId, idempotencyKey: key };
    const record = { ...newSyncRecovery(scope, document, 7), dirty: true, pending: command };
    const restored = validateSyncRecovery(scope, JSON.parse(JSON.stringify(record)));
    expect(restored.document).toEqual(document);
    expect(restored.pending).toEqual(command);
    expect(restored.document.sitesPresentation).toBeUndefined();
    expect(restored.document.syncPresentation?.sourceRevision).toBe(original.syncPresentation?.sourceRevision);
  });
  it("never interprets a newer database revision as the receipt of an uncertain save", () => {
    const command: MobileSyncStudioRequestV3 = { operation: "save", document: original, expectedDraftRevision: 7, projectId: scope.projectId, idempotencyKey: key };
    const restored = syncRecoveryWithCurrent({ ...newSyncRecovery(scope, original, 7), dirty: true, pending: command }, 8);
    expect(restored.pending).toEqual(command);
    expect(restored.draftRevision).toBe(7);
    expect(restored.conflict).toBe(true);
  });
  it("opens the current server document instead of a clean older local journal", () => {
    const old = newSyncRecovery(scope, original, 7);
    const current = updateSyncStudioDocument(original, { ...original.syncPresentation!, body: "Nieuwe serverinhoud" });
    const restored = hydrateSyncRecovery(scope, old, current, 8);
    expect(restored.document).toEqual(current);
    expect(restored.draftRevision).toBe(8);
    expect(restored.dirty).toBe(false);
    expect(restored.conflict).toBe(false);
    const dirty = hydrateSyncRecovery(scope, { ...old, dirty: true }, current, 8);
    expect(dirty.document).toEqual(original);
    expect(dirty.draftRevision).toBe(7);
    expect(dirty.conflict).toBe(true);
  });

  it("keeps transient empty-name input and a series rename's original CAS baseline across a reopen", () => {
    const record = { ...newSyncRecovery(scope, original, 7), fieldInput: { name: "" }, dirty: true, seriesInput: { name: "Mijn nieuwe reeksnaam", expectedRevision: 3 } };
    const restored = hydrateSyncRecovery(scope, JSON.parse(JSON.stringify(record)), original, 7);
    expect(restored.fieldInput.name).toBe("");
    expect(restored.seriesInput).toEqual({ name: "Mijn nieuwe reeksnaam", expectedRevision: 3 });
    const clean = hydrateSyncRecovery(scope, { ...record, dirty: false }, original, 8);
    expect(clean.draftRevision).toBe(8);
    expect(clean.seriesInput?.expectedRevision).toBe(3);
  });
  it.each(["userId", "tenantId", "projectId"] as const)("refuses a recovery record from another %s", field => {
    const record = newSyncRecovery(scope, original, 7);
    expect(() => validateSyncRecovery({ ...scope, [field]: "90000000-0000-4000-8000-000000000001" }, record)).toThrow("andere sessie");
  });
  it("refuses a validly shaped command for a different project inside the journal", () => {
    const record = newSyncRecovery(scope, original, 7);
    expect(() => validateSyncRecovery(scope, { ...record, pending: { operation: "render", projectId: key, expectedDraftRevision: 7, outputKind: "mp4", idempotencyKey: key } })).toThrow("ander");
  });
  it("keeps a mismatched project or incomplete render receipt uncertain", () => {
    const command: MobileSyncStudioRequestV3 = { operation: "render", projectId: scope.projectId, expectedDraftRevision: 7, outputKind: "mp4", idempotencyKey: key };
    const result = { outcome: "queued" as const, projectId: scope.projectId, draftRevision: 7, renderJobId: key, series: null };
    expect(() => assertSyncReceipt(command, result)).not.toThrow();
    expect(() => assertSyncReceipt(command, { ...result, projectId: key })).toThrow("ontvangstbewijs");
    expect(() => assertSyncReceipt(command, { ...result, renderJobId: null })).toThrow("ontvangstbewijs");
    expect(() => assertSyncReceipt(command, { ...result, draftRevision: 8 })).toThrow("ontvangstbewijs");
    expect(() => assertSyncReceipt(command, { ...result, outcome: "conflict", projectId: key })).toThrow("ontvangstbewijs");
  });
  it("requires an advancing revision for a saved receipt", () => {
    const command: MobileSyncStudioRequestV3 = { operation: "save", projectId: scope.projectId, expectedDraftRevision: 7, document: original, idempotencyKey: key };
    expect(() => assertSyncReceipt(command, { outcome: "saved", projectId: scope.projectId, draftRevision: 7, renderJobId: null, series: null })).toThrow("ontvangstbewijs");
    expect(() => assertSyncReceipt(command, { outcome: "saved", projectId: scope.projectId, draftRevision: 8, renderJobId: null, series: null })).not.toThrow();
  });
});
