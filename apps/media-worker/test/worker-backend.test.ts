import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createConfiguredMediaWorkerClient,
  SupabaseMediaWorkerBackend,
  type ClaimedMediaJob,
  type WorkerBackendError,
  type WorkerRpcClient
} from "../src/worker-backend";

const job: ClaimedMediaJob = {
  assetId: "20000000-0000-4000-8000-000000000003",
  attemptCount: 1,
  fileSizeBytes: 11,
  jobId: "30000000-0000-4000-8000-000000000004",
  mimeType: "video/mp4",
  originalFileName: "intro.mp4",
  storageBucket: "media",
  storagePath: "tenants/tenant one/assets/video/original/intro.mp4",
  tenantId: "10000000-0000-4000-8000-000000000001"
};
const directories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((path) =>
    rm(path, { force: true, recursive: true })
  ));
});

describe("Supabase media worker backend", () => {
  it("bounds a stalled configured data RPC without exposing server credentials", async () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:56521");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test_fixture_only");
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    const transport = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("deadline", "AbortError")), { once: true });
    }));
    const client = createConfiguredMediaWorkerClient(transport);
    const pending = Promise.resolve(client.rpc("get_worker_queue_hint_v2"));
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    expect(timeout).toHaveBeenCalledWith(30_000);
    deadline.abort();
    expect((await pending).error).not.toBeNull();
  });

  it("preserves caller cancellation when applying a configured RPC deadline", async () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:56521");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test_fixture_only");
    const caller = new AbortController();
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    let received: AbortSignal | null | undefined;
    const client = createConfiguredMediaWorkerClient(async (_input, init) => {
      received = init?.signal;
      return new Response("0", { headers: { "content-type": "application/json" } });
    });
    await client.rpc("get_worker_queue_hint_v2").abortSignal(caller.signal);
    expect(received?.aborted).toBe(false);
    caller.abort();
    expect(received?.aborted).toBe(true);
    expect(deadline.signal.aborted).toBe(false);
  });
  it("evaluates due publisher schedules through the server-only RPC", async () => {
    const rpc = vi.fn<WorkerRpcClient["rpc"]>().mockResolvedValue({
      data: 3,
      error: null
    });
    const backend = createBackend({ rpc });
    const evaluatedAt = new Date("2026-07-23T14:00:00.000Z");

    await expect(backend.applyDueSchedules(evaluatedAt)).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith("apply_due_content_schedules_v1", {
      p_now: evaluatedAt.toISOString()
    });
  });

  it("rejects invalid publisher schedule results", async () => {
    const backend = createBackend({
      rpc: vi.fn<WorkerRpcClient["rpc"]>().mockResolvedValue({
        data: "not-a-count",
        error: null
      })
    });

    await expect(backend.applyDueSchedules(new Date())).rejects.toEqual(
      expect.objectContaining<Partial<WorkerBackendError>>({
        code: "schedule_apply_invalid",
        retryable: false
      })
    );
  });

  it("maps an atomic claim response without losing bigint values", async () => {
    const rpc = vi.fn<WorkerRpcClient["rpc"]>().mockResolvedValue({
      data: [{
        asset_id: job.assetId,
        attempt_count: 1,
        file_size_bytes: "11",
        job_id: job.jobId,
        mime_type: job.mimeType,
        original_file_name: job.originalFileName,
        storage_bucket: job.storageBucket,
        storage_path: job.storagePath,
        tenant_id: job.tenantId
      }],
      error: null
    });
    const backend = createBackend({ rpc });

    await expect(backend.claimJob("worker:test", 900, 3)).resolves.toEqual(job);
    expect(rpc).toHaveBeenCalledWith("claim_media_processing_job", {
      p_lock_timeout_seconds: 900,
      p_max_attempts: 3,
      p_worker_id: "worker:test"
    });
  });

  it("streams storage downloads and uploads using encoded tenant paths", async () => {
    const directory = await temporaryDirectory();
    const sourcePath = join(directory, "source.mp4");
    const outputPath = join(directory, "output.mp4");
    const posterPath = join(directory, "poster.png");
    await writeFile(outputPath, "normalized");
    await writeFile(posterPath, "poster");
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("hello world", { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const backend = createBackend(
      { rpc: vi.fn() },
      fetchMock
    );

    await backend.downloadOriginal(job, sourcePath);
    expect(await readFile(sourcePath, "utf8")).toBe("hello world");
    await backend.uploadPlayerVariant(job, outputPath, "tenants/t/assets/a/variants/player.mp4");
    await backend.uploadPosterVariant(job, posterPath, "tenants/t/assets/a/variants/poster.png");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/media/tenants/tenant%20one/assets/video/original/intro.mp4"
    );
    const uploadRequest = fetchMock.mock.calls[1]?.[1];
    expect(uploadRequest).toMatchObject({
      duplex: "half",
      method: "POST"
    });
    expect(new Headers(uploadRequest?.headers).get("x-upsert")).toBe("false");
    expect(await new Response(uploadRequest?.body).text()).toBe("normalized");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("content-type"))
      .toBe("image/png");
  });

  it("uses the exact atomic completion RPC contract", async () => {
    const rpc = vi.fn<WorkerRpcClient["rpc"]>().mockResolvedValue({
      data: null,
      error: null
    });
    const backend = createBackend({ rpc });

    await backend.completeJob({
      assetId: job.assetId,
      durationSeconds: 12.5,
      height: 720,
      jobId: job.jobId,
      originalChecksum: "a".repeat(64),
      posterChecksum: "c".repeat(64),
      posterSizeBytes: 120,
      posterStoragePath: "tenants/t/assets/a/variants/poster.png",
      playerChecksum: "b".repeat(64),
      playerSizeBytes: 900,
      playerStoragePath: "tenants/t/assets/a/variants/player-1080p.mp4",
      width: 1280,
      workerId: "worker:test"
    });

    expect(rpc).toHaveBeenCalledWith("complete_media_processing_job", {
      p_duration_seconds: 12.5,
      p_height: 720,
      p_job_id: job.jobId,
      p_original_checksum_sha256: "a".repeat(64),
      p_poster_checksum_sha256: "c".repeat(64),
      p_poster_file_size_bytes: 120,
      p_poster_storage_path: "tenants/t/assets/a/variants/poster.png",
      p_player_checksum_sha256: "b".repeat(64),
      p_player_file_size_bytes: 900,
      p_player_storage_path: "tenants/t/assets/a/variants/player-1080p.mp4",
      p_width: 1280,
      p_worker_id: "worker:test"
    });
  });

  it("classifies permanent and transient storage failures", async () => {
    const permanent = createBackend(
      { rpc: vi.fn() },
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }))
    );
    const transient = createBackend(
      { rpc: vi.fn() },
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(permanent.downloadOriginal(job, "/unused")).rejects.toEqual(
      expect.objectContaining<Partial<WorkerBackendError>>({ retryable: false })
    );
    await expect(transient.downloadOriginal(job, "/unused")).rejects.toEqual(
      expect.objectContaining<Partial<WorkerBackendError>>({ retryable: true })
    );
  });

  it("bounds a stalled storage transfer without scheduling another long retry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true
        });
      })
    );
    const backend = createBackend({ rpc: vi.fn() }, fetchMock, 5);

    await expect(backend.downloadOriginal(job, "/unused")).rejects.toEqual(
      expect.objectContaining<Partial<WorkerBackendError>>({
        code: "source_download_timeout",
        retryable: false
      })
    );
  });
});

function createBackend(
  client: WorkerRpcClient,
  fetchImplementation: typeof fetch = vi.fn(),
  storageTimeoutMs?: number
) {
  return new SupabaseMediaWorkerBackend(
    "https://project.supabase.co",
    "service-secret",
    { client, fetch: fetchImplementation, storageTimeoutMs }
  );
}

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "veyocast-backend-test-"));
  directories.push(path);
  return path;
}
