import { describe, expect, it, vi } from "vitest";

import {
  PublicationVersionPruneRunner,
  type PublicationVersionPruneClient,
  type PublicationVersionPruneRunResult
} from "../src/publication-version-prune-runner";

function createRunner(rpc: unknown) {
  return new PublicationVersionPruneRunner({ rpc } as PublicationVersionPruneClient);
}

describe("queued publication version retention runner", () => {
  it.each(["completed", "idle"] as const)("uses only the guarded database RPC and reports %s", async (status) => {
    const rpc = vi.fn().mockResolvedValue({ data: { status, pruned: 3, diagnostic: "private-details" }, error: null });
    const result = await createRunner(rpc).runOnce();
    expect(result).toEqual({ status });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("prune_queued_publication_versions_v1", { p_limit: 25 });
    expect(JSON.stringify(result)).not.toContain("private-details");
  });

  it("contains returned and thrown RPC failures and succeeds on the next attempt", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "private database failure" } })
      .mockRejectedValueOnce(new Error("https://database.invalid/?token=private-secret"))
      .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
    const runner = createRunner(rpc);
    const failures = [await runner.runOnce(), await runner.runOnce()];
    expect(failures).toEqual([
      { errorCode: "publication_version_prune_failed", status: "failed" },
      { errorCode: "publication_version_prune_failed", status: "failed" }
    ]);
    expect(JSON.stringify(failures)).not.toContain("private");
    expect(await runner.runOnce()).toEqual({ status: "completed" });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it.each([
    null,
    undefined,
    [],
    { status: "failed" },
    { status: 1 },
    { status: { toString: (): string => "completed" } }
  ])("does not claim success for malformed RPC output", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    expect(await createRunner(rpc).runOnce()).toEqual({
      errorCode: "publication_version_prune_response_invalid", status: "failed"
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("does not call a provider or direct-delete API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External HTTP is forbidden."));
    try {
      const directDelete = vi.fn(() => { throw new Error("Direct deletion is forbidden."); });
      const rpc = vi.fn().mockResolvedValue({ data: { status: "completed" }, error: null });
      const runner = new PublicationVersionPruneRunner({ rpc, from: directDelete } as unknown as PublicationVersionPruneClient);
      expect(await runner.runOnce()).toEqual({ status: "completed" });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(directDelete).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("skips work when already draining", async () => {
    const controller = new AbortController();
    controller.abort();
    const rpc = vi.fn();
    expect(await createRunner(rpc).runOnce(controller.signal)).toEqual({ status: "idle" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("backs off exponentially on database outages and resets after success", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let loop: Promise<void> | null = null;
    try {
      const rpc = vi.fn()
        .mockRejectedValueOnce(new Error("private-outage-1"))
        .mockRejectedValueOnce(new Error("private-outage-2"))
        .mockResolvedValueOnce({ data: { status: "completed" }, error: null })
        .mockRejectedValueOnce(new Error("private-outage-3"))
        .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
      const results: PublicationVersionPruneRunResult[] = [];
      loop = createRunner(rpc).loop({
        intervalMs: 25,
        signal: controller.signal,
        onSettled: (result) => {
          results.push(result);
          if (results.length === 5) controller.abort();
        }
      });
      await vi.advanceTimersByTimeAsync(24);
      expect(rpc).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      expect(rpc).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(49);
      expect(rpc).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(rpc).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(24);
      expect(rpc).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(1);
      await loop;
      expect(results.map((result) => result.status)).toEqual(["failed", "failed", "completed", "failed", "completed"]);
      expect(JSON.stringify(results)).not.toContain("private");
    } finally {
      controller.abort();
      try { if (loop) await loop; }
      finally { vi.useRealTimers(); }
    }
  });

  it("bounds repeated failures at one attempt per minute and cancels the delay on drain", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let loop: Promise<void> | null = null;
    try {
      const rpc = vi.fn().mockRejectedValue(new Error("private long outage"));
      loop = createRunner(rpc).loop({ intervalMs: 30_000, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(rpc).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(rpc).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(rpc).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(rpc).toHaveBeenCalledTimes(4);
      controller.abort();
      await loop;
    } finally {
      controller.abort();
      try { if (loop) await loop; }
      finally { vi.useRealTimers(); }
    }
  });

  it("survives a failed queue hint and a failed observer without stopping the worker", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let loop: Promise<void> | null = null;
    try {
      const rpc = vi.fn().mockResolvedValue({ data: { status: "completed" }, error: null });
      const waitForWork = vi.fn()
        .mockRejectedValueOnce(new Error("private hint failure"))
        .mockResolvedValue(undefined);
      const results: PublicationVersionPruneRunResult[] = [];
      loop = createRunner(rpc).loop({
        intervalMs: 25,
        onSettled: (result) => {
          results.push(result);
          if (result.status === "failed") throw new Error("private observer failure");
          controller.abort();
        },
        signal: controller.signal,
        waitForWork
      });
      await vi.advanceTimersByTimeAsync(24);
      expect(rpc).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await loop;
      expect(results).toEqual([
        { errorCode: "publication_version_prune_wait_failed", status: "failed" },
        { status: "completed" }
      ]);
      expect(waitForWork).toHaveBeenCalledTimes(2);
      expect(rpc).toHaveBeenCalledOnce();
    } finally {
      controller.abort();
      try { if (loop) await loop; }
      finally { vi.useRealTimers(); }
    }
  });

  it("does not spin while idle without queue hints", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let loop: Promise<void> | null = null;
    try {
      const rpc = vi.fn().mockResolvedValue({ data: { status: "idle" }, error: null });
      loop = createRunner(rpc).loop({ intervalMs: 1_000, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(999);
      expect(rpc).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      expect(rpc).toHaveBeenCalledTimes(2);
    } finally {
      controller.abort();
      try { if (loop) await loop; }
      finally { vi.useRealTimers(); }
    }
  });
});
