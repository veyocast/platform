import type { Buffer } from "node:buffer";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PublicationVersionPruneRunner,
  type PublicationVersionPruneClient,
  type PublicationVersionPruneRunResult
} from "../src/publication-version-prune-runner";
import { createConfiguredMediaWorkerClient } from "../src/worker-backend";
import { runWorkerTaskGroup } from "../src/worker-lifecycle";

function createRunner(rpc: unknown) {
  // Existing unit transports resolve promises; the pinned SDK returns a
  // thenable builder whose signal method keeps the same request.
  const client = { rpc: (...args: unknown[]) => {
    const request = Promise.resolve((rpc as (...values: unknown[]) => unknown)(...args));
    return Object.assign(request, { abortSignal: () => request });
  } } as unknown as PublicationVersionPruneClient;
  return new PublicationVersionPruneRunner(client);
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function within<T>(pending: Promise<T>, milliseconds = 500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("native_request_did_not_stop")), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function hangingNativeRpc() {
  let start!: () => void, closeResponse!: () => void;
  const started = new Promise<void>((resolve) => { start = resolve; });
  const responseClosed = new Promise<void>((resolve) => { closeResponse = resolve; });
  const requests: Array<{ method: string | undefined; path: string | undefined; body: string }> = [];
  const server = createServer((request, response) => {
    const observed = { method: request.method, path: request.url, body: "" };
    requests.push(observed);
    request.on("data", (chunk: Buffer) => { observed.body += chunk.toString("utf8"); });
    request.on("end", start);
    response.on("close", closeResponse);
    // Intentionally leave the native request open until its owned signal aborts.
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  vi.stubEnv("SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test_fixture_only");
  let receivedSignal: AbortSignal | null | undefined;
  const client = createConfiguredMediaWorkerClient((input, init) => {
    receivedSignal = init?.signal;
    return fetch(input, init);
  });
  return { client, started, responseClosed, requests, signal: () => receivedSignal,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }) };
}

describe("queued publication version retention runner", () => {
  it("cancels a hanging native pinned-SDK prune request without leaking the abort reason", async () => {
    const deadline = vi.spyOn(AbortSignal, "timeout");
    const fixture = await hangingNativeRpc(), controller = new AbortController();
    const rpc = vi.spyOn(fixture.client, "rpc");
    const runner = new PublicationVersionPruneRunner(fixture.client);
    const pending = runner.runOnce(controller.signal);
    const privateReason = "https://private.invalid/?token=PRIVATE_ABORT_REASON";
    try {
      await within(fixture.started, 1000);
      expect(fixture.requests).toEqual([{ method: "POST", path: "/rest/v1/rpc/prune_queued_publication_versions_v1", body: '{"p_limit":25}' }]);
      expect(fixture.signal()?.aborted).toBe(false);
      expect(deadline).toHaveBeenCalledWith(30_000);
      controller.abort(new Error(privateReason));
      const result = await within(pending);
      expect(result).toEqual({ errorCode: "publication_version_prune_failed", status: "failed" });
      expect(JSON.stringify(result)).not.toContain(privateReason);
      expect(fixture.signal()?.aborted).toBe(true);
      await within(fixture.responseClosed);
      expect(await runner.runOnce(controller.signal)).toEqual({ status: "idle" });
      expect(rpc).toHaveBeenCalledOnce();
      expect(fixture.requests).toHaveLength(1);
    } finally {
      controller.abort();
      await fixture.close();
      await within(pending, 1000);
    }
  });

  it("drains a loop with a hanging native pinned-SDK call before the unchanged twenty-second deadline", async () => {
    const fixture = await hangingNativeRpc(), controller = new AbortController();
    const results: PublicationVersionPruneRunResult[] = [];
    const onDraining = vi.fn(), onDrainTimeout = vi.fn();
    const loop = new PublicationVersionPruneRunner(fixture.client).loop({
      signal: controller.signal, onSettled: (result) => { results.push(result); }
    });
    const group = runWorkerTaskGroup({ controller, onDraining, onDrainTimeout, tasks: [loop] });
    try {
      await within(fixture.started, 1000);
      controller.abort("PRIVATE_DRAIN_REASON");
      await within(group);
      await within(fixture.responseClosed);
      expect(onDraining).toHaveBeenCalledOnce();
      expect(onDrainTimeout).not.toHaveBeenCalled();
      expect(fixture.requests).toHaveLength(1);
      expect(results).toEqual([{ errorCode: "publication_version_prune_failed", status: "failed" }]);
      expect(JSON.stringify(results)).not.toContain("PRIVATE_DRAIN_REASON");
    } finally {
      controller.abort();
      await fixture.close();
      await within(group, 1000);
    }
  });

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
    controller.abort(new Error("PRIVATE_REASON_BEFORE_REQUEST"));
    const rpc = vi.fn();
    expect(await createRunner(rpc).runOnce(controller.signal)).toEqual({ status: "idle" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("contains a signal-attachment failure without exposing SDK error details", async () => {
    const controller = new AbortController();
    const privateFailure = Object.assign(new Error("https://private.invalid/?token=PRIVATE_SIGNAL_ERROR"), {
      code: "PRIVATE_SDK_CODE", cause: "PRIVATE_SDK_CAUSE"
    });
    const abortSignal = vi.fn(() => { throw privateFailure; });
    const rpc = vi.fn(() => ({ abortSignal }));
    const runner = new PublicationVersionPruneRunner({ rpc } as unknown as PublicationVersionPruneClient);
    const result = await runner.runOnce(controller.signal);
    expect(result).toEqual({ errorCode: "publication_version_prune_failed", status: "failed" });
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(controller.signal.aborted).toBe(false);
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
