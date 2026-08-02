import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runSportlinkSyncOnce,
  SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

afterEach(() => {
  vi.useRealTimers();
});

describe("Sportlink sync worker", () => {
  it("claims a command once and reports missing encryption configuration safely", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          connection_id: "20000000-0000-4000-8000-000000000001",
          data_source_id: "30000000-0000-4000-8000-000000000001",
          dataset_group: "matches",
          encrypted_client_id: "ciphertext",
          encryption_iv: "initialization",
          encryption_tag: "authentication",
          run_id: "40000000-0000-4000-8000-000000000001",
          tenant_id: "10000000-0000-4000-8000-000000000001"
        }],
        error: null
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: null,
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({
      datasetGroup: "matches",
      errorCode: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      runId: "40000000-0000-4000-8000-000000000001",
      status: "failed"
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "claim_due_sportlink_sync_v1", {
      p_lock_timeout_seconds: 900,
      p_worker_id: "worker:sportlink"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "fail_sportlink_sync_v1", {
      p_error_code: "SPORTLINK_CONFIGURATION_UNAVAILABLE",
      p_error_detail: "De serverconfiguratie voor Sportlink-synchronisatie ontbreekt.",
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });
  });

  it("does not execute anything when no dataset is due", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );

    await expect(runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    })).resolves.toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("renews the lease while a provider dataset is still being fetched", async () => {
    vi.useFakeTimers();
    let finishDataset: ((value: {
      activities: [];
      club: null;
      matches: [];
      standings: [];
      teams: [];
    }) => void) | undefined;
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_due_sportlink_sync_v1") {
        return {
          data: [{
            connection_id: "20000000-0000-4000-8000-000000000001",
            data_source_id: "30000000-0000-4000-8000-000000000001",
            dataset_group: "competitions",
            encrypted_client_id: "ciphertext",
            encryption_iv: "initialization",
            encryption_tag: "authentication",
            run_id: "40000000-0000-4000-8000-000000000001",
            tenant_id: "10000000-0000-4000-8000-000000000001"
          }],
          error: null
        };
      }
      if (functionName === "renew_sportlink_sync_lease_v1") {
        return { data: true, error: null };
      }
      if (functionName === "complete_sportlink_sync_v1") {
        return { data: { readCount: 0 }, error: null };
      }
      return { data: null, error: null };
    });
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc }
    );
    const execution = runSportlinkSyncOnce({
      backend,
      encryptionKey: "x".repeat(32),
      executeDataset: () => new Promise((resolve) => {
        finishDataset = resolve;
      }),
      lockTimeoutSeconds: 900,
      workerId: "worker:sportlink"
    });

    await vi.waitFor(() => expect(finishDataset).toBeTypeOf("function"));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(rpc).toHaveBeenCalledWith("renew_sportlink_sync_lease_v1", {
      p_run_id: "40000000-0000-4000-8000-000000000001",
      p_worker_id: "worker:sportlink"
    });

    finishDataset?.({
      activities: [],
      club: null,
      matches: [],
      standings: [],
      teams: []
    });
    await expect(execution).resolves.toEqual({
      datasetGroup: "competitions",
      readCount: 0,
      runId: "40000000-0000-4000-8000-000000000001",
      status: "completed"
    });
  });
});
