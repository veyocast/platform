import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import {
  normalizePlayerVideo,
  VideoProcessingError,
  type VideoNormalizationResult
} from "./video-normalization";
import type { MediaWorkerConfig } from "./worker-config";
import {
  WorkerBackendError,
  type ClaimedMediaJob,
  type MediaWorkerBackend
} from "./worker-backend";

type Normalizer = (input: {
  inputPath: string;
  outputPath: string;
}) => Promise<VideoNormalizationResult>;

export type WorkerRunResult =
  | { status: "idle" }
  | { assetId: string; jobId: string; status: "completed" }
  | {
      assetId: string;
      errorCode: string;
      jobId: string;
      status: "failed" | "retry_scheduled";
    };

export async function runWorkerOnce({
  backend,
  config,
  normalize = normalizePlayerVideo
}: {
  backend: MediaWorkerBackend;
  config: MediaWorkerConfig;
  normalize?: Normalizer;
}): Promise<WorkerRunResult> {
  const job = await backend.claimJob(
    config.workerId,
    config.lockTimeoutSeconds,
    config.maxAttempts
  );
  if (!job) return { status: "idle" };

  let workingDirectory: string | null = null;
  try {
    assertSupportedJob(job);
    workingDirectory = await mkdtemp(join(tmpdir(), "castivo-media-"));
    const inputPath = join(workingDirectory, "source.mp4");
    const outputPath = join(workingDirectory, "player-1080p.mp4");

    await backend.downloadOriginal(job, inputPath);
    const inputStat = await stat(inputPath);
    if (inputStat.size !== job.fileSizeBytes) {
      throw new JobProcessingError(
        "source_size_mismatch",
        false,
        "Het gedownloade bronbestand heeft niet de verwachte grootte."
      );
    }
    const originalChecksum = await sha256File(inputPath);
    const normalized = await normalize({ inputPath, outputPath });
    const outputStat = await stat(outputPath);
    const playerChecksum = await sha256File(outputPath);
    const playerStoragePath =
      `tenants/${job.tenantId}/assets/${job.assetId}/variants/player-1080p.mp4`;

    await backend.uploadPlayerVariant(job, outputPath, playerStoragePath);
    await backend.completeJob({
      assetId: job.assetId,
      durationSeconds: normalized.output.durationSeconds,
      height: normalized.output.height,
      jobId: job.jobId,
      originalChecksum,
      playerChecksum,
      playerSizeBytes: outputStat.size,
      playerStoragePath,
      width: normalized.output.width,
      workerId: config.workerId
    });
    return { assetId: job.assetId, jobId: job.jobId, status: "completed" };
  } catch (error) {
    const failure = classifyFailure(error);
    let status: "failed" | "queued";
    try {
      status = await backend.failJob({
        errorCode: failure.code,
        errorMessage: failure.message,
        jobId: job.jobId,
        maxAttempts: config.maxAttempts,
        retryable: failure.retryable,
        workerId: config.workerId
      });
    } catch (reportingError) {
      throw new WorkerRunFatalError(
        "De job mislukte en de foutstatus kon niet worden opgeslagen.",
        reportingError
      );
    }
    return {
      assetId: job.assetId,
      errorCode: failure.code,
      jobId: job.jobId,
      status: status === "queued" ? "retry_scheduled" : "failed"
    };
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  }
}

export async function runWorkerLoop({
  backend,
  config,
  onResult = () => undefined,
  signal
}: {
  backend: MediaWorkerBackend;
  config: MediaWorkerConfig;
  onResult?: (result: WorkerRunResult) => void;
  signal: AbortSignal;
}) {
  while (!signal.aborted) {
    const result = await runWorkerOnce({ backend, config });
    onResult(result);
    if (result.status === "idle") {
      await abortableDelay(config.pollIntervalMs, signal);
    }
  }
}

export class WorkerRunFatalError extends Error {
  readonly code = "worker_state_update_failed";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "WorkerRunFatalError";
  }
}

class JobProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "JobProcessingError";
  }
}

function assertSupportedJob(job: ClaimedMediaJob) {
  if (job.mimeType !== "video/mp4") {
    throw new JobProcessingError(
      "unsupported_mime_type",
      false,
      "De worker accepteert alleen video/mp4."
    );
  }
}

function classifyFailure(error: unknown) {
  if (error instanceof JobProcessingError || error instanceof WorkerBackendError) {
    return error;
  }
  if (error instanceof VideoProcessingError) {
    return new JobProcessingError(
      error.code,
      error.code === "command_failed",
      safeMessage(error.message)
    );
  }
  return new JobProcessingError(
    "worker_internal_error",
    true,
    "De mediajob is door een interne workerfout onderbroken."
  );
}

async function sha256File(path: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

function safeMessage(message: string) {
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}
