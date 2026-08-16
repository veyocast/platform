import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { VEYOCAST_APPS, getLocalUrl } from "@veyocast/config";
import { createStructuredLogger } from "@veyocast/observability";

import { readMediaWorkerConfig } from "./worker-config";
import { SupabaseMediaWorkerBackend } from "./worker-backend";
import { closeServer, createWorkerRuntimeHealth } from "./worker-health";
import { runWorkerTaskGroup } from "./worker-lifecycle";
import { runWorkerLoop, runWorkerOnce } from "./worker-runner";
import {
  runScheduleLoop,
  type ScheduleRunResult
} from "./schedule-runner";
import { SupabaseStudioRenderBackend } from "./studio-render-backend";
import { ResvgSharpStudioRenderer } from "./studio-render-resvg";
import {
  runStudioRenderLoop,
  runStudioRenderOnce,
  type StudioRenderRunResult
} from "./studio-render-runner";
import { runServiceMonitor } from "./service-monitor";
import { SupabaseDynamicRenderBackend } from "./dynamic-render-backend";
import {
  runDynamicRenderLoop,
  runDynamicRenderOnce,
  type DynamicRenderRunResult
} from "./dynamic-render-runner";
import { ReactDomDynamicThumbnailRenderer } from "./dynamic-react-thumbnail";
import {
  SupabaseRssSyncBackend,
  runRssSyncLoop,
  runRssSyncOnce,
  type RssSyncRunResult
} from "./rss-sync-runner";
import {
  SupabaseSportlinkSyncBackend,
  runSportlinkSyncLoop,
  runSportlinkSyncOnce,
  type SportlinkSyncRunResult
} from "./sportlink-sync-runner";

export {
  createMediaProcessingPlan,
  maxUploadBytes,
  maxVideoDurationSeconds,
  validateMediaCandidate
} from "./media-processing";
export {
  buildNormalizationArguments,
  canRemuxWithoutTranscoding,
  getCanonicalPlayerDimensions,
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
  PlayerVideoDimensions,
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
export { runScheduleLoop, runScheduleOnce } from "./schedule-runner";
export type { ScheduleRunResult } from "./schedule-runner";
export {
  SupabaseStudioRenderBackend,
  studioRenderArtifactPaths
} from "./studio-render-backend";
export { ResvgSharpStudioRenderer } from "./studio-render-resvg";
export {
  runStudioRenderLoop,
  runStudioRenderOnce
} from "./studio-render-runner";
export type { StudioRenderRunResult } from "./studio-render-runner";
export { closeServer, createWorkerRuntimeHealth } from "./worker-health";
export type { WorkerRuntimeHealth } from "./worker-health";
export {
  SupabaseDynamicRenderBackend,
  dynamicRenderStoragePath,
  parseClaimedDynamicRenderJob
} from "./dynamic-render-backend";
export type {
  ClaimedDynamicRenderJob,
  DynamicRenderBackend
} from "./dynamic-render-backend";
export {
  classifyDynamicRenderFailure,
  runDynamicRenderLoop,
  runDynamicRenderOnce
} from "./dynamic-render-runner";
export type { DynamicRenderRunResult } from "./dynamic-render-runner";
export {
  SupabaseRssSyncBackend,
  runRssSyncLoop,
  runRssSyncOnce
} from "./rss-sync-runner";
export type { ClaimedRssSync, RssSyncRunResult } from "./rss-sync-runner";
export {
  SupabaseSportlinkSyncBackend,
  runSportlinkSyncLoop,
  runSportlinkSyncOnce
} from "./sportlink-sync-runner";
export type {
  ClaimedSportlinkSync,
  SportlinkSyncRunResult
} from "./sportlink-sync-runner";

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
  const studioBackend = new SupabaseStudioRenderBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  const dynamicBackend = new SupabaseDynamicRenderBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  const rssBackend = new SupabaseRssSyncBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  const sportlinkBackend = new SupabaseSportlinkSyncBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  const studioRenderer = new ResvgSharpStudioRenderer();
  const reactDomRenderer = process.env.MONITOR_PLAYER_URL
    ? new ReactDomDynamicThumbnailRenderer(process.env.MONITOR_PLAYER_URL)
    : undefined;
  if (mode === "--once") {
    const mediaResult = await runWorkerOnce({ backend, config });
    logWorkerResult(logger, mediaResult);
    const studioResult = await runStudioRenderOnce({
      backend: studioBackend,
      config,
      renderer: studioRenderer
    });
    logStudioRenderResult(logger, studioResult);
    const dynamicResult = await runDynamicRenderOnce({
      backend: dynamicBackend,
      config,
      reactDomRenderer,
      renderer: studioRenderer
    });
    logDynamicRenderResult(logger, dynamicResult);
    const rssResult = await runRssSyncOnce({
      backend: rssBackend,
      lockTimeoutSeconds: config.lockTimeoutSeconds,
      workerId: config.workerId
    });
    logRssSyncResult(logger, rssResult);
    const sportlinkResult = await runSportlinkSyncOnce({
      backend: sportlinkBackend,
      encryptionKey: config.sportlinkEncryptionKey,
      lockTimeoutSeconds: config.lockTimeoutSeconds,
      workerId: config.workerId
    });
    logSportlinkSyncResult(logger, sportlinkResult);
    if (
      mediaResult.status === "failed" ||
      studioResult.status === "failed" ||
      dynamicResult.status === "failed" ||
      rssResult.status === "failed" ||
      sportlinkResult.status === "failed"
    ) {
      process.exitCode = 1;
    }
    return;
  }

  const controller = new AbortController();
  const runtimeHealth = createWorkerRuntimeHealth();
  const healthServer = await runtimeHealth.startServer();
  let draining = false;
  const stop = () => {
    if (draining) return;
    draining = true;
    runtimeHealth.markDraining();
    logger.info("media.worker.draining");
    controller.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    logger.info("media.worker.started", { workerId: config.workerId });
    await runWorkerTaskGroup({
      controller,
      onDraining: stop,
      tasks: [
        runWorkerLoop({
          backend,
          config,
          onQueuePoll: runtimeHealth.markPoll,
          onResult: (result) => {
            runtimeHealth.markPoll();
            runtimeHealth.markResult(result.status);
            logWorkerResult(logger, result);
          },
          signal: controller.signal
        }),
        runScheduleLoop({
          backend,
          intervalMs: config.schedulePollIntervalMs,
          onResult: (result) => logScheduleResult(logger, result),
          signal: controller.signal
        }),
        runStudioRenderLoop({
          backend: studioBackend,
          config,
          intervalMs: config.pollIntervalMs,
          onQueuePoll: runtimeHealth.markPoll,
          onResult: (result) => {
            runtimeHealth.markPoll();
            runtimeHealth.markResult(
              result.status === "completed" ||
                result.status === "idle" ||
                result.status === "retry_scheduled"
                ? result.status
                : "failed"
            );
            logStudioRenderResult(logger, result);
          },
          renderer: studioRenderer,
          signal: controller.signal
        }),
        runDynamicRenderLoop({
          backend: dynamicBackend,
          config,
          intervalMs: config.pollIntervalMs,
          onResult: (result) => {
            runtimeHealth.markPoll();
            runtimeHealth.markResult(
              result.status === "completed" ||
                result.status === "idle" ||
                result.status === "retry_scheduled"
                ? result.status
                : "failed"
            );
            logDynamicRenderResult(logger, result);
          },
          renderer: studioRenderer,
          reactDomRenderer,
          signal: controller.signal
        }),
        runRssSyncLoop({
          backend: rssBackend,
          intervalMs: config.schedulePollIntervalMs,
          lockTimeoutSeconds: config.lockTimeoutSeconds,
          onResult: (result) => logRssSyncResult(logger, result),
          signal: controller.signal,
          workerId: config.workerId
        }),
        runSportlinkSyncLoop({
          backend: sportlinkBackend,
          encryptionKey: config.sportlinkEncryptionKey,
          intervalMs: config.schedulePollIntervalMs,
          lockTimeoutSeconds: config.lockTimeoutSeconds,
          onResult: (result) => logSportlinkSyncResult(logger, result),
          signal: controller.signal,
          workerId: config.workerId
        }),
        ...serviceMonitorTasks(controller.signal, logger)
      ]
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await closeServer(healthServer);
    logger.info("media.worker.stopped");
  }
}

function logSportlinkSyncResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: SportlinkSyncRunResult
) {
  const eventLogger =
    result.status === "idle" ? logger : logger.withCorrelation(result.runId);
  if (result.status === "idle") {
    eventLogger.debug("sportlink.sync.queue_polled", { outcome: "idle" });
  } else if (result.status === "completed") {
    eventLogger.info("sportlink.sync.completed", {
      datasetGroup: result.datasetGroup,
      outcome: result.status,
      readCount: result.readCount
    });
  } else {
    eventLogger.error("sportlink.sync.failed", {
      datasetGroup: result.datasetGroup,
      errorCode: result.errorCode,
      outcome: result.status
    });
  }
}

function logDynamicRenderResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: DynamicRenderRunResult
) {
  const eventLogger =
    result.status === "idle" ? logger : logger.withCorrelation(result.jobId);
  if (result.status === "idle") {
    eventLogger.debug("dynamic.render.queue_polled", { outcome: "idle" });
  } else if (result.status === "completed") {
    eventLogger.info("dynamic.render.completed", {
      jobId: result.jobId,
      mediaAssetId: result.mediaAssetId,
      outcome: result.status
    });
  } else {
    eventLogger.error("dynamic.render.failed", {
      errorCode: result.errorCode,
      jobId: result.jobId,
      mediaAssetId: result.mediaAssetId,
      outcome: result.status
    });
  }
}

function logRssSyncResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: RssSyncRunResult
) {
  const eventLogger =
    result.status === "idle" ? logger : logger.withCorrelation(result.runId);
  if (result.status === "idle") {
    eventLogger.debug("dynamic.rss.queue_polled", { outcome: "idle" });
  } else if (result.status === "completed") {
    eventLogger.info("dynamic.rss.completed", {
      dataSourceId: result.dataSourceId,
      itemCount: result.itemCount,
      outcome: result.status
    });
  } else {
    eventLogger.error("dynamic.rss.failed", {
      dataSourceId: result.dataSourceId,
      errorCode: result.errorCode,
      outcome: result.status
    });
  }
}

function serviceMonitorTasks(
  signal: AbortSignal,
  logger: ReturnType<typeof createStructuredLogger>
) {
  const webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    logger.info("monitor.disabled", { reason: "webhook_not_configured" });
    return [];
  }
  const targets = [
    ["control", process.env.MONITOR_CONTROL_URL],
    ["player", process.env.MONITOR_PLAYER_URL],
    ["marketing", process.env.MONITOR_MARKETING_URL]
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, url]) => ({ name, url }));
  if (!targets.length) {
    logger.error("monitor.disabled", { reason: "targets_not_configured" });
    return [];
  }
  return [runServiceMonitor({
    environment: process.env.VEYOCAST_ENVIRONMENT ?? "unknown",
    onEvent: (event, fields) => {
      if (event.endsWith(".failed")) logger.error(event, fields);
      else logger.info(event, fields);
    },
    signal,
    targets,
    webhookUrl
  })];
}

function logStudioRenderResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: StudioRenderRunResult
) {
  const eventLogger =
    result.status === "idle" ? logger : logger.withCorrelation(result.jobId);
  if (result.status === "idle") {
    eventLogger.debug("studio.render.queue_polled", { outcome: "idle" });
  } else if (result.status === "completed") {
    eventLogger.info("studio.render.completed", {
      jobId: result.jobId,
      mediaAssetId: result.mediaAssetId,
      outcome: result.status
    });
  } else {
    eventLogger.error("studio.render.failed", {
      errorCode: result.errorCode,
      jobId: result.jobId,
      mediaAssetId: result.mediaAssetId,
      outcome: result.status
    });
  }
}

function logScheduleResult(
  logger: ReturnType<typeof createStructuredLogger>,
  result: ScheduleRunResult
) {
  if (result.status === "completed") {
    const eventLogger = result.appliedCount === 0 ? logger.debug : logger.info;
    eventLogger("publisher.schedule.evaluated", {
      appliedCount: result.appliedCount,
      evaluatedAt: result.evaluatedAt
    });
    return;
  }
  logger.error("publisher.schedule.failed", {
    errorCode: result.errorCode,
    evaluatedAt: result.evaluatedAt
  });
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
