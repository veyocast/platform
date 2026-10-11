import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SupabaseRssSyncBackend,
  runRssSyncLoop,
  runRssSyncOnce
} from "../src/rss-sync-runner";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("scheduled RSS backend", () => {
  it("does not upload or invalidate the same content across 100 source checks", async () => {
    let present = false;
    const upload = vi.fn(async () => { present = true; return { error: null }; });
    const exists = vi.fn(async () => ({ data: present, error: null }));
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "service-role", {
      rpc: vi.fn(), storage: { from: () => ({ upload, exists }) }
    });
    const artifact = { assetId: "content-id", bytes: new Uint8Array([1, 2]), checksumSha256: "a".repeat(64),
      externalId: null, fileSizeBytes: 2, height: 10, width: 10, mimeType: "image/webp" as const,
      role: "provider_logo" as const, storagePath: "tenants/tenant/assets/content-id/rss-provider_logo.webp", title: "Logo" };
    for (let i = 0; i < 100; i += 1) await backend.uploadMedia([artifact]);
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]).toEqual([artifact.storagePath, artifact.bytes, {
      cacheControl: "31536000", contentType: "image/webp", upsert: false
    }]);
  });
  it("laat een lege queue ongemoeid", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const backend = new SupabaseRssSyncBackend(
      "https://supabase.test",
      "service-role",
      { rpc }
    );
    await expect(runRssSyncOnce({
      backend,
      lockTimeoutSeconds: 120,
      workerId: "rss-worker"
    })).resolves.toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("isolates a claim RPC outage without exposing provider details or failing an unowned job", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("private provider URL and token"));
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "test-only", { rpc });
    await expect(runRssSyncOnce({ backend, lockTimeoutSeconds: 120, workerId: "rss-worker" }))
      .resolves.toEqual({ errorCode: "rss_sync_claim_failed", status: "failed" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("aborts an unresponsive Supabase claim at the transport deadline", async () => {
    let requestSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init?.signal;
      requestSignal?.addEventListener("abort", () => reject(new DOMException("Request timed out", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "test-only", undefined, 10);
    await expect(runRssSyncOnce({ backend, lockTimeoutSeconds: 120, workerId: "rss-worker" }))
      .resolves.toEqual({ errorCode: "rss_sync_claim_failed", status: "failed" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("recovers from claim outages without a burst retry and stops immediately on abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const rpc = vi.fn().mockRejectedValue(new Error("database timeout"));
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "test-only", { rpc });
    const onResult = vi.fn();
    const execution = runRssSyncLoop({
      backend, intervalMs: 15_000, lockTimeoutSeconds: 120,
      onResult, signal: controller.signal, workerId: "rss-worker"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rpc).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(rpc).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rpc).toHaveBeenCalledTimes(4);
    rpc.mockResolvedValue({ data: [], error: null });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rpc).toHaveBeenCalledTimes(5);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    controller.abort();
    await expect(execution).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues dispatching when persisting a feed failure also fails", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "test-only", { rpc: vi.fn() });
    const claim = vi.spyOn(backend, "claim").mockResolvedValueOnce({
      dataSourceId: "source", runId: "run", sourceUrl: "http://127.0.0.1/blocked-feed", tenantId: "tenant"
    }).mockResolvedValue(null);
    const fail = vi.spyOn(backend, "fail").mockRejectedValue(new Error("database unavailable during failure recording"));
    const onResult = vi.fn((result: { status: string }) => {
      if (result.status === "idle") controller.abort();
    });
    const execution = runRssSyncLoop({
      backend, intervalMs: 1_000, lockTimeoutSeconds: 120,
      onResult, signal: controller.signal, workerId: "rss-worker"
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fail).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", errorCode: "rss_fetch_blocked" }));
    expect(claim).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(execution).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith({ status: "idle" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
