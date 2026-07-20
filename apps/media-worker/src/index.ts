import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { VEYOCAST_APPS, getLocalUrl } from "@veyocast/config";
import { createStructuredLogger } from "@veyocast/observability";

import { readMediaWorkerConfig } from "./worker-config";
import { SupabaseMediaWorkerBackend } from "./worker-backend";
import { closeServer, createWorkerRuntimeHealth } from "./worker-health";
import { runWorkerLoop, runWorkerOnce } from "./worker-runner";

export {
  createMediaProcessingPlan,
  maxUploadBytes,
  maxVideoDurationSeconds,
  validateMediaCandidate
} from "./media-processing";
export {
  buildNormalizationArguments,
  canRemuxWithoutTranscoding,
  maximumNormalizationTimeMs,
  normalizePlayerVideo,
  parseVideoProbe,
  probeVideoFile,
  runCommand,
  validateInputProbe,
  validatePlayerVariant,
  VideoProcessingError
} from "./video-normalization";
export type {
  CommandResult,
  CommandRunner,
  VideoNormalizationResult,
  VideoProbe
} from "./video-normalization";
export type {
  MediaCandidate,
  MediaKind,
  MediaProcessingPlan,
  MediaRejection,
  ProcessingVariant
} from "./media-processing";
export {
  readMediaWorkerConfig,
  WorkerConfigurationError
} from "./worker-config";
export type { MediaWorkerConfig } from "./worker-config";
export {
  SupabaseMediaWorkerBackend,
  WorkerBackendError
} from "./worker-backend";
export type {
  ClaimedMediaJob,
  CompleteMediaJobInput,
  FailMediaJobInput,
  MediaWorkerBackend
} from "./worker-backend";
export {
  runWorkerLoop,
  runWorkerOnce,
  WorkerRunFatalError
} from "./worker-runner";
export type { WorkerRunResult } from "./worker-runner";
export { closeServer, createWorkerRuntimeHealth } from "./worker-health";
export type { WorkerRuntimeHealth } from "./worker-health";

export type WorkerHealth = {
  service: string;
  status: "ok";
  checkedAt: string;
  controlUrl: string;
};

export function getWorkerHealth(now = new Date()): WorkerHealth {
  return {
    service: VEYOCAST_APPS["media-worker"].name,
    status: "ok",
    checkedAt: now.toISOString(),
    controlUrl: getLocalUrl("control")
  };
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "--once" && mode !== "--loop") {
    console.log(JSON.stringify(getWorkerHealth(), null, 2));
    return;
  }

  const config = readMediaWorkerConfig();
  const logger = createStructuredLogger({
    environment: process.env.VEYOCAST_ENVIRONMENT ?? "development",
    revision: process.env.DEPLOYMENT_SHA ?? "development",
    service: "media-worker"
  });
  const backend = new SupabaseMediaWorkerBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  if (mode === "--once") {
    const result = await runWorkerOnce({ backend, config });
    logWorkerResult(logger, result);
    if (result.status === "failed") process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const runtimeHealth = createWorkerRuntimeHealth();
  const healthServer = await runtimeHealth.startServer();
  const stop = () => {
    runtimeHealth.markDraining();
    logger.info("media.worker.draining");
    controller.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    logger.info("media.worker.started", { workerId: config.workerId });
    await runWorkerLoop({
      backend,
      config,
      onQueuePoll: runtimeHealth.markPoll,
      onResult: (result) => {
        runtimeHealth.markPoll();
        runtimeHealth.markResult(result.status);
        logWorkerResult(logger, result);
      },
      signal: controller.signal
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await closeServer(healthServer);
    logger.info("media.worker.stopped");
  }
}

function logWorkerResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: Awaited<ReturnType<typeof runWorkerOnce>>
) {
  const eventLogger = result.status === "idle" ? logger : logger.withCorrelation(result.jobId);
  if (result.status === "idle") {
    eventLogger.debug("media.queue.polled", { outcome: "idle" });
  } else if (result.status === "completed") {
    eventLogger.info("media.job.completed", {
      assetId: result.assetId,
      jobId: result.jobId,
      outcome: result.status
    });
  } else {
    eventLogger.error("media.job.failed", {
      assetId: result.assetId,
      errorCode: result.errorCode,
      jobId: result.jobId,
      outcome: result.status
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "worker_unhandled_error";
    createStructuredLogger({
      environment: process.env.VEYOCAST_ENVIRONMENT ?? "development",
      revision: process.env.DEPLOYMENT_SHA ?? "development",
      service: "media-worker"
    }, (line) => process.stderr.write(`${line}\n`)).error("media.job.failed", {
      errorCode: code,
      errorName: error instanceof Error ? error.name : "unknown",
      outcome: "worker_unhandled_error"
    });
    process.exitCode = 1;
  });
}
