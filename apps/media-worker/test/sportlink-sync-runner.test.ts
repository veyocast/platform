import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectSportlinkPoolContexts,
  collectSportlinkPoolIds,
  runSportlinkSyncOnce,
  SupabaseSportlinkSyncBackend
} from "../src/sportlink-sync-runner";

afterEach(() => {
  vi.useRealTimers();
});

describe("Sportlink sync worker", () => {
  it("derives bounded club pools without an incomplete team-pool request", () => {
    expect(collectSportlinkPoolIds(
      [
        { poulecode: 90, teamcode: 10, teamnaam: "Club 1" },
        { poulecode: null, teamcode: 11, teamnaam: "Club 2" },
        { poulecode: 90, teamcode: 12, teamnaam: "Club 3" }
      ],
      [
        { poulecode: 91, teamcode: 11 },
        { poulecode: 92, teamcode: 999 }
      ]
    )).toEqual(["90", "91"]);
  });

  it("keeps competition and season with every standings context", () => {
    expect(collectSportlinkPoolContexts(
      [{
        competitie: "Vierde klasse",
        poule: "4C",
        poulecode: 701,
        seizoen: "2026/2027",
        teamcode: 10
      }],
      []
    )).toEqual([{
      competition: expect.objectContaining({
        name: "Vierde klasse",
        season: "2026/2027"
      }),
      poolExternalId: "701",
      poolName: "4C"
    }]);
  });

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

  it("uploads an official club logo locally before completing the provider run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { readCount: 1 },
      error: null
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upload }));
    const backend = new SupabaseSportlinkSyncBackend(
      "https://project.supabase.co",
      "service-secret",
      { rpc, storage: { from } }
    );
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(backend.complete({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "club_profile",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001"
    }, "worker:sportlink", {
      activities: [],
      club: {
        city: "Den Haag",
        clubCode: "DUIN",
        colors: { primary: null, secondary: null, text: null },
        externalId: "club-1",
        foundedOn: null,
        information: null,
        logoUrl: null,
        name: "Duindorp sv",
        websiteUrl: null
      },
      clubLogo: {
        assetId: "50000000-0000-5000-8000-000000000001",
        bytes,
        checksumSha256: "a".repeat(64),
        fileSizeBytes: 3,
        height: 100,
        mimeType: "image/webp",
        role: "club_logo",
        storagePath: "tenants/10000000-0000-4000-8000-000000000001/assets/50000000-0000-5000-8000-000000000001/sportlink-club-logo.webp",
        title: "Duindorp sv clublogo",
        width: 100
      },
      matches: [],
      standings: [],
      teamLogos: [],
      teams: []
    })).resolves.toBe(1);

    expect(from).toHaveBeenCalledWith("tenant-media");
    expect(upload).toHaveBeenCalledWith(
      "tenants/10000000-0000-4000-8000-000000000001/assets/50000000-0000-5000-8000-000000000001/sportlink-club-logo.webp",
      bytes,
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true
      }
    );
    expect(rpc).toHaveBeenCalledWith("complete_sportlink_sync_v3", expect.objectContaining({
      p_club_logo: expect.objectContaining({
        assetId: "50000000-0000-5000-8000-000000000001",
        role: "club_logo"
      }),
      p_run_id: "40000000-0000-4000-8000-000000000001"
    }));
  });

  it("renews the lease while a provider dataset is still being fetched", async () => {
    vi.useFakeTimers();
    let finishDataset: ((value: {
      activities: [];
      club: null;
      clubLogo: null;
      matches: [];
      standings: [];
      teamLogos: [];
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
      if (functionName === "complete_sportlink_sync_v3") {
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
      clubLogo: null,
      matches: [],
      standings: [],
      teamLogos: [],
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
