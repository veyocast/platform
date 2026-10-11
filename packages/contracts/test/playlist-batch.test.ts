import { describe, expect, it } from "vitest";
import { playlistBatchCommandSchema } from "../src/playlist-batch";
const playlistId = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";
const idempotencyKey = "00000000-0000-4000-8000-000000000003";
describe("bounded atomic playlist commands", () => {
  it("keeps a partial patch partial and rejects accidental rich-field replacement", () => {
    const command = playlistBatchCommandSchema.parse({ playlistId, expectedRevision: 4, idempotencyKey, operations: [{ operation: "patch", itemId, patch: { durationSeconds: 3 } }] });
    expect(command.operations[0]).toEqual({ operation: "patch", itemId, patch: { durationSeconds: 3 } });
    expect(playlistBatchCommandSchema.safeParse({ ...command, operations: [{ operation: "patch", itemId, patch: { unrelated: "drop this" } }] }).success).toBe(false);
  });
  it("rejects duplicate add identities, duplicate order IDs and oversized operation lists", () => {
    const operation = { operation: "add_media", clientId: itemId, mediaAssetId: playlistId, durationSeconds: 12 };
    const base = { playlistId, expectedRevision: 4, idempotencyKey };
    expect(playlistBatchCommandSchema.safeParse({ ...base, operations: [operation, operation] }).success).toBe(false);
    expect(playlistBatchCommandSchema.safeParse({ ...base, operations: [{ operation: "reorder", itemIds: [itemId, itemId] }] }).success).toBe(false);
    expect(playlistBatchCommandSchema.safeParse({ ...base, operations: Array.from({ length: 201 }, () => ({ operation: "remove", itemId })) }).success).toBe(false);
  });
});
