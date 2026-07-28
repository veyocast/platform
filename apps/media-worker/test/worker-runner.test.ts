import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { VideoProcessingError, type VideoProbe } from "../src/video-normalization";
import type { MediaWorkerConfig } from "../src/worker-config";
import type {
  ClaimedMediaJob,
  MediaWorkerBackend
} from "../src/worker-backend";
import { runWorkerOnce } from "../src/worker-runner";

const source = "source-video";
const output = "normalized-video";
const job: ClaimedMediaJob = {
  assetId: "20000000-0000-4000-8000-000000000003",
  attemptCount: 1,
  fileSizeBytes: Buffer.byteLength(source),
  jobId: "30000000-0000-4000-8000-000000000004",
  mimeType: "video/mp4",
  originalFileName: "intro.mp4",
  storageBucket: "media",
  storagePath: "tenants/100/assets/200/original/intro.mp4",
  tenantId: "10000000-0000-4000-8000-000000000001"
};
const config: MediaWorkerConfig = {
  lockTimeoutSeconds: 900,
  maxAttempts: 3,
  pollIntervalMs: 2_000,
  schedulePollIntervalMs: 15_000,
  serviceRoleKey: "service-secret",
  sportlinkEncryptionKey: null,
  supabaseUrl: "https://project.supabase.co",
  workerId: "worker:test"
};
const outputProbe: VideoProbe = {
  audioCodec: "aac",
  durationSeconds: 12.5,
  formatNames: ["mov", "mp4"],
  framesPerSecond: 30,
  height: 1080,
  pixelFormat: "yuv420p",
  videoCodec: "h264",
  width: 1920
};

describe("media worker runner", () => {
  it("returns idle when the atomic queue has no work", async () => {
    const backend = createBackend(null);
    await expect(runWorkerOnce({ backend, config })).resolves.toEqual({ status: "idle" });
    expect(backend.downloadOriginal).not.toHaveBeenCalled();
  });

  it("verifies, normalizes, uploads and atomically completes a claimed job", async () => {
    const backend = createBackend(job);
    const normalize = vi.fn(async ({ outputPath }: { inputPath: string; outputPath: string }) => {
      await writeFile(outputPath, output);
      return { input: outputProbe, output: outputProbe, outputPath };
    });

    await expect(runWorkerOnce({ backend, config, normalize })).resolves.toEqual({
      assetId: job.assetId,
      jobId: job.jobId,
      status: "completed"
    });
    expect(backend.uploadPlayerVariant).toHaveBeenCalledWith(
      job,
      expect.stringMatching(/player-1080p\.mp4$/),
      `tenants/${job.tenantId}/assets/${job.assetId}/variants/player-1080p.mp4`
    );
    expect(backend.completeJob).toHaveBeenCalledWith(expect.objectContaining({
      durationSeconds: 12.5,
      height: 1080,
      originalChecksum: sha256(source),
      playerChecksum: sha256(output),
      playerSizeBytes: Buffer.byteLength(output),
      width: 1920,
      workerId: config.workerId
    }));
    expect(backend.failJob).not.toHaveBeenCalled();
  });

  it("fails permanently before normalization when the source size differs", async () => {
    const backend = createBackend({ ...job, fileSizeBytes: 999 });
    const normalize = vi.fn();

    await expect(runWorkerOnce({ backend, config, normalize })).resolves.toMatchObject({
      errorCode: "source_size_mismatch",
      status: "failed"
    });
    expect(normalize).not.toHaveBeenCalled();
    expect(backend.failJob).toHaveBeenCalledWith(expect.objectContaining({
      retryable: false
    }));
  });

  it("reschedules transient command failures within the attempt budget", async () => {
    const backend = createBackend(job, "queued");
    const normalize = vi.fn().mockRejectedValue(
      new VideoProcessingError("command_failed", "FFmpeg tijdelijk niet beschikbaar.")
    );

    await expect(runWorkerOnce({ backend, config, normalize })).resolves.toMatchObject({
      errorCode: "command_failed",
      status: "retry_scheduled"
    });
    expect(backend.failJob).toHaveBeenCalledWith(expect.objectContaining({
      maxAttempts: 3,
      retryable: true
    }));
  });

  it("fails a bounded processing timeout without another minute-long retry", async () => {
    const backend = createBackend(job);
    const normalize = vi.fn().mockRejectedValue(
      new VideoProcessingError("processing_timeout", "FFmpeg overschreed 50 seconden.")
    );

    await expect(runWorkerOnce({ backend, config, normalize })).resolves.toMatchObject({
      errorCode: "processing_timeout",
      status: "failed"
    });
    expect(backend.failJob).toHaveBeenCalledWith(expect.objectContaining({
      retryable: false
    }));
  });
});

function createBackend(
  claimedJob: ClaimedMediaJob | null,
  failureStatus: "failed" | "queued" = "failed"
) {
  return {
    applyDueSchedules: vi.fn().mockResolvedValue(0),
    claimJob: vi.fn().mockResolvedValue(claimedJob),
    completeJob: vi.fn().mockResolvedValue(undefined),
    downloadOriginal: vi.fn(async (_job, path: string) => writeFile(path, source)),
    failJob: vi.fn().mockResolvedValue(failureStatus),
    uploadPlayerVariant: vi.fn().mockResolvedValue(undefined)
  } satisfies MediaWorkerBackend;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
