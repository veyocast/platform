import {describe, expect, it} from "vitest";
import {createSyncStudioStarter} from "../src/sync";
import {createEmptyStudioDocument} from "../src/document";
import {mobileSyncStudioRequestV3Schema, mobileSyncStudioResultV3Schema} from "../src/mobile-control-v3";

const id = "19170000-0000-4000-8000-000000000901";
const document = createSyncStudioStarter({family: "club-story", tenantName: "Eigen club"});
describe("versioned native Sync protocol", () => {
  it("retains the complete document rather than translating it into Sites", () => {
    document.metadata.tenantBrandApplied = true;
    const command = {operation: "save", projectId: id, expectedDraftRevision: 7, document, idempotencyKey: id};
    expect(mobileSyncStudioRequestV3Schema.parse(command)).toEqual(command);
  });
  it("rejects legacy or advanced documents on the new Sync writer", () => {
    expect(mobileSyncStudioRequestV3Schema.safeParse({operation: "create", document: createEmptyStudioDocument("landscape-hd"), idempotencyKey: id}).success).toBe(false);
  });
  it("rejects mismatched series revisions and duplicate ordering members", () => {
    const input = {operation: "series", projectId: id, draftRevision: 0, seriesId: id, seriesRevision: null, action: "reorder", name: null, memberIds: [id, id], idempotencyKey: id};
    expect(mobileSyncStudioRequestV3Schema.safeParse(input).success).toBe(false);
  });
  it("starts a new series only through add and requires a current series for duplication", () => {
    const input = {operation: "series", projectId: id, draftRevision: 0, seriesId: null, seriesRevision: null, action: "duplicate", name: null, memberIds: null, idempotencyKey: id};
    expect(mobileSyncStudioRequestV3Schema.safeParse(input).success).toBe(false);
    expect(mobileSyncStudioRequestV3Schema.safeParse({...input, action: "add"}).success).toBe(true);
  });
  it("does not accept a queued receipt without its actual job identity", () => {
    const input = {outcome: "queued", projectId: id, draftRevision: 2, renderJobId: null, series: null};
    expect(mobileSyncStudioResultV3Schema.safeParse(input).success).toBe(false);
    expect(mobileSyncStudioResultV3Schema.safeParse({...input, renderJobId: id}).success).toBe(true);
  });
  it("does not accept a series receipt pointing outside its returned members", () => {
    expect(mobileSyncStudioResultV3Schema.safeParse({outcome: "applied", projectId: id, draftRevision: 0, renderJobId: null, series: {id, revision: 2, projectIds: [id], nextProjectId: "19170000-0000-4000-8000-000000000902"}}).success).toBe(false);
  });
});
