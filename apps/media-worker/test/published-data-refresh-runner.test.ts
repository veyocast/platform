import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  PublishedDataRefreshRunner,
  type PublishedDataRefreshClient,
  type PublishedDataRefreshRunResult
} from "../src/published-data-refresh-runner";

const job = {
  leaseToken: "30000000-0000-4000-8000-000000000003",
  snapshotId: "20000000-0000-4000-8000-000000000002",
  tenantId: "10000000-0000-4000-8000-000000000001"
};
const leaseArgs = {
  p_lease_token: job.leaseToken,
  p_snapshot_id: job.snapshotId,
  p_tenant_id: job.tenantId
};

function createRunner(rpc: unknown, leaseSeconds?: number) {
  const client = { rpc: (...args: unknown[]) => {
    const request = (rpc as (...parameters: unknown[]) => Promise<unknown>)(...args);
    return Object.assign(request, { abortSignal: () => request });
  } } as unknown as PublishedDataRefreshClient;
  return new PublishedDataRefreshRunner(client, {
    leaseSeconds,
    workerId: "worker:test"
  });
}

describe("database-only published data refresh runner", () => {
  it("returns idle when there is no claim and makes no other database request", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await createRunner(rpc).runOnce()).toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("claim_published_data_refresh_v1", {
      p_lease_seconds: 60, p_worker_id: "worker:test"
    });
  });

  it.each(["completed", "retry"] as const)("completes the exact tenant/snapshot lease and reports %s", async (status) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce({ data: { status }, error: null });
    const result = await createRunner(rpc, 90).runOnce();
    expect(result).toEqual({ snapshotId: job.snapshotId, status, tenantId: job.tenantId });
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_published_data_refresh_v1", {
      p_lease_seconds: 90, p_worker_id: "worker:test"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_published_data_refresh_v1", leaseArgs);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain(job.leaseToken);
  });

  it("refreshes only through the injected database client without provider HTTP access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Provider access is forbidden."));
    try {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: job, error: null })
        .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
      expect(await createRunner(rpc).runOnce()).toMatchObject({ status: "completed" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it.each([
    { data: undefined, error: null },
    { data: { ...job, tenantId: "external-invalid-value" }, error: null },
    { data: [job], error: null },
    { data: { tenantId: job.tenantId, snapshotId: job.snapshotId }, error: null }
  ])("rejects an invalid claim without sending untrusted identities to completion", async (response) => {
    const rpc = vi.fn().mockResolvedValue(response);
    expect(await createRunner(rpc).runOnce()).toEqual({
      errorCode: "published_data_refresh_claim_invalid", status: "failed"
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("recovers after a claim RPC returns a database error without exposing its details", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "private database details" } })
      .mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
    const runner = createRunner(rpc);
    const failure = await runner.runOnce();
    expect(failure).toEqual({ errorCode: "published_data_refresh_claim_failed", status: "failed" });
    expect(JSON.stringify(failure)).not.toContain("private database details");
    expect(await runner.runOnce()).toMatchObject({ status: "completed" });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("contains a thrown claim transport error and succeeds on the next attempt", async () => {
    const rpc = vi.fn()
      .mockRejectedValueOnce(new Error("https://database.invalid/?token=private-secret"))
      .mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
    const runner = createRunner(rpc);
    const failure = await runner.runOnce();
    expect(failure).toEqual({ errorCode: "published_data_refresh_claim_failed", status: "failed" });
    expect(JSON.stringify(failure)).not.toContain("private-secret");
    expect(await runner.runOnce()).toMatchObject({ status: "completed" });
  });

  it("records a safe completion failure against only its claimed lease", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private provider/database details" } })
      .mockResolvedValueOnce({ data: true, error: null });
    const result = await createRunner(rpc).runOnce();
    expect(result).toEqual({
      errorCode: "published_data_refresh_complete_failed",
      snapshotId: job.snapshotId,
      status: "failed",
      tenantId: job.tenantId
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "fail_published_data_refresh_v1", {
      ...leaseArgs, p_error_code: "published_data_refresh_complete_failed"
    });
    expect(JSON.stringify(result)).not.toContain("private provider/database details");
    expect(JSON.stringify(result)).not.toContain(job.leaseToken);
  });

  it.each([
    { data: null, error: null },
    { data: { status: "unexpected" }, error: null },
    { data: { status: { toString: (): string => "completed" } }, error: null }
  ])("does not claim completion for an invalid completion response", async (response) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce({ data: true, error: null });
    expect(await createRunner(rpc).runOnce()).toMatchObject({
      errorCode: "published_data_refresh_completion_invalid", status: "failed"
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "fail_published_data_refresh_v1", {
      ...leaseArgs, p_error_code: "published_data_refresh_completion_invalid"
    });
  });

  it.each(["returned", "thrown"])("preserves the runner when failure recording also loses the database (%s)", async (mode) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: job, error: null })
      .mockRejectedValueOnce(new Error("private completion exception"));
    if (mode === "returned") rpc.mockResolvedValueOnce({ data: false, error: { message: "private database outage" } });
    else rpc.mockRejectedValueOnce(new Error("private database outage"));
    rpc.mockResolvedValueOnce({ data: job, error: null })
      .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
    const runner = createRunner(rpc);
    const failure = await runner.runOnce();
    expect(failure).toMatchObject({ errorCode: "published_data_refresh_complete_failed", status: "failed" });
    expect(JSON.stringify(failure)).not.toContain("private");
    expect(await runner.runOnce()).toMatchObject({ status: "completed" });
  });

  it("does not claim during shutdown or record failure when shutdown follows the claim", async () => {
    const controller = new AbortController();
    const rpc = vi.fn().mockResolvedValue({ data: job, error: null });
    controller.abort();
    expect(await createRunner(rpc).runOnce(controller.signal)).toEqual({ status: "idle" });
    expect(rpc).not.toHaveBeenCalled();

    const duringClaim = new AbortController();
    rpc.mockImplementationOnce(async () => {
      duringClaim.abort();
      return { data: job, error: null };
    }).mockResolvedValueOnce({ data: true, error: null });
    expect(await createRunner(rpc).runOnce(duringClaim.signal)).toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it.each(["claim", "complete", "fail"])("cancels a real native SDK %s request without a later RPC or shutdown accounting", async (stage) => {
    const paths: string[] = []; let began!: () => void, closed!: () => void;
    const active = new Promise<void>((resolve) => { began = resolve; });
    const disconnected = new Promise<void>((resolve) => { closed = resolve; });
    const server = createServer((request, response) => {
      const path = request.url ?? ""; paths.push(path); request.resume();
      if (path === `/rest/v1/rpc/${stage}_published_data_refresh_v1`) {
        response.on("close", closed); began(); return;
      }
      response.setHeader("Content-Type", "application/json");
      if (path.includes("claim_")) response.end(JSON.stringify(job));
      else { response.statusCode = 500; response.end(JSON.stringify({ code: "57014", message: "PRIVATE_ERROR" })); }
    });
    await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); if (!address || typeof address === "string") throw new Error("fixture_address_invalid");
    const controller = new AbortController(); const settled = vi.fn();
    const runner = new PublishedDataRefreshRunner(createClient(`http://127.0.0.1:${address.port}`, "fixture-only", {
      auth: { persistSession: false, autoRefreshToken: false }
    }), { workerId: "worker:test" });
    let execution: Promise<void> | undefined;
    try {
      execution = runner.loop({ signal: controller.signal, onSettled: settled });
      await active; controller.abort("PRIVATE_ABORT_REASON");
      await execution; await disconnected;
      expect(paths).toEqual(["claim", ...(stage !== "claim" ? ["complete"] : []), ...(stage === "fail" ? ["fail"] : [])]
        .map((name) => `/rest/v1/rpc/${name}_published_data_refresh_v1`));
      expect(settled).not.toHaveBeenCalled();
    } finally {
      controller.abort(); server.closeAllConnections();
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
      await execution;
    }
  });

  it("keeps an acknowledged completion even if shutdown arrives with its response", async () => {
    const controller = new AbortController();
    const rpc = vi.fn().mockResolvedValueOnce({ data: job, error: null })
      .mockImplementationOnce(async () => { controller.abort(); return { data: { status: "completed" }, error: null }; });
    expect(await createRunner(rpc).runOnce(controller.signal)).toMatchObject({ status: "completed" });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("keeps the loop running after wait and RPC outages with bounded retries", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let loop: Promise<void> | null = null;
    try {
      const rpc = vi.fn()
        .mockRejectedValueOnce(new Error("private connection failure"))
        .mockResolvedValueOnce({ data: job, error: null })
        .mockResolvedValueOnce({ data: { status: "completed" }, error: null });
      const waitForWork = vi.fn()
        .mockRejectedValueOnce(new Error("private hint failure"))
        .mockResolvedValue(undefined);
      const results: PublishedDataRefreshRunResult[] = [];
      loop = createRunner(rpc).loop({
        intervalMs: 25,
        onSettled: (result) => {
          results.push(result);
          if (result.status === "completed") controller.abort();
        },
        signal: controller.signal,
        waitForWork
      });
      await vi.advanceTimersByTimeAsync(24);
      expect(rpc).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(rpc).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(25);
      await loop;
      expect(results.map((result) => result.status)).toEqual(["failed", "failed", "completed"]);
      expect(results.slice(0, 2)).toEqual([
        { errorCode: "published_data_refresh_wait_failed", status: "failed" },
        { errorCode: "published_data_refresh_claim_failed", status: "failed" }
      ]);
      expect(JSON.stringify(results)).not.toContain("private");
      expect(waitForWork).toHaveBeenCalledTimes(3);
    } finally {
      controller.abort();
      try { if (loop) await loop; }
      finally { vi.useRealTimers(); }
    }
  });
});
