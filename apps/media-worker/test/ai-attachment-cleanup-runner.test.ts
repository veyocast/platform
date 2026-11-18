import { describe, expect, it, vi } from "vitest";
import { AiAttachmentCleanupRunner } from "../src/ai-attachment-cleanup-runner";

const tenantId = "31700000-0000-4000-8000-000000000001";
const assetId = "31700000-0000-4000-8000-000000000002";
const token = "31700000-0000-4000-8000-000000000003";
const path = `tenants/${tenantId}/assets/${assetId}/original/concept.png`;

function fixture(lease: unknown, removeError: unknown = null, complete = true) {
  const events: string[] = [];
  const rpc = vi.fn(async (name: string) => { events.push(name); return { data: name === "claim_ai_attachment_cleanup_v1" ? lease : complete, error: null }; });
  const remove = vi.fn(async () => { events.push("storage.remove"); return { error: removeError }; });
  const client = { rpc, storage: { from: vi.fn(() => ({ remove })) } } as unknown as ConstructorParameters<typeof AiAttachmentCleanupRunner>[0];
  return { runner: new AiAttachmentCleanupRunner(client), rpc, remove, events };
}

describe("private AI attachment cleanup", () => {
  it("does nothing without an eligible private attachment", async () => {
    const test = fixture(null); expect(await test.runner.runOnce()).toEqual({ status: "idle" }); expect(test.remove).not.toHaveBeenCalled();
  });
  it("removes exact leased tenant paths before acknowledging metadata", async () => {
    const test = fixture({ outcome: "claimed", attachmentId: assetId, tenantId, token, paths: [{ bucket: "tenant-media", path }, { bucket: "tenant-media", path }] });
    expect(await test.runner.runOnce()).toEqual({ status: "completed" });
    expect(test.remove).toHaveBeenCalledExactlyOnceWith([path]);
    expect(test.events).toEqual(["claim_ai_attachment_cleanup_v1", "storage.remove", "complete_ai_attachment_cleanup_v1"]);
  });
  for (const outcome of ["protected", "deferred", "empty"]) it(`never deletes ${outcome} candidates`, async () => {
    const test = fixture({ outcome }); expect(await test.runner.runOnce()).toEqual({ status: "completed" }); expect(test.remove).not.toHaveBeenCalled();
  });
  it("rejects a foreign tenant path without touching Storage", async () => {
    const test = fixture({ outcome: "claimed", attachmentId: assetId, tenantId, token, paths: [{ bucket: "tenant-media", path: `tenants/other/assets/${assetId}/original/concept.png` }] });
    expect(await test.runner.runOnce()).toMatchObject({ status: "failed" }); expect(test.remove).not.toHaveBeenCalled(); expect(test.rpc).toHaveBeenCalledTimes(1);
  });
  it("retains the lease when Storage fails so a controlled retry can finish", async () => {
    const test = fixture({ outcome: "claimed", attachmentId: assetId, tenantId, token, paths: [{ bucket: "tenant-media", path }] }, { message: "PRIVATE transport detail" });
    expect(await test.runner.runOnce()).toEqual({ status: "failed", errorCode: "ai_attachment_cleanup_failed" }); expect(test.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not falsely acknowledge a stale completion receipt", async () => {
    const test = fixture({ outcome: "claimed", attachmentId: assetId, tenantId, token, paths: [{ bucket: "tenant-media", path }] }, null, false);
    expect(await test.runner.runOnce()).toMatchObject({ status: "failed" }); expect(test.remove).toHaveBeenCalledTimes(1);
  });
  it("does not claim work after shutdown", async () => {
    const test = fixture(null); const controller = new AbortController(); controller.abort();
    expect(await test.runner.runOnce(controller.signal)).toEqual({ status: "idle" }); expect(test.rpc).not.toHaveBeenCalled();
  });
});
