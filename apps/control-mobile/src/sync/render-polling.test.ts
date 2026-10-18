import { describe, expect, it } from "vitest";
import { syncRenderPollDelay } from "./render-polling";
describe("bounded native render observation", () => {
  it("does not poll idle, completed, dirty, pending or hidden editors", () => {
    for (const status of ["idle", "completed", "failed", "cancelled", "unknown"]) expect(syncRenderPollDelay(status, 0, 4000, true)).toBe(false);
    expect(syncRenderPollDelay("rendering", 0, 4000, false)).toBe(false);
  });
  it("backs off a running render and stops after two minutes", () => {
    expect(syncRenderPollDelay("queued", 0, 0, true)).toBe(4000);
    expect(syncRenderPollDelay("rendering", 0, 35_000, true)).toBe(8000);
    expect(syncRenderPollDelay("rendering", 0, 70_000, true)).toBe(15_000);
    expect(syncRenderPollDelay("rendering", 0, 120_000, true)).toBe(false);
  });
});
