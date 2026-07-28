import { describe, expect, it, vi } from "vitest";

import {
  runSportlinkSyncOnce,
  SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

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
});
