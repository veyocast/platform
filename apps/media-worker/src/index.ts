import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { VEYOCAST_APPS, getLocalUrl } from "@veyocast/config";

import { readMediaWorkerConfig } from "./worker-config";
import { SupabaseMediaWorkerBackend } from "./worker-backend";
import { runWorkerLoop, runWorkerOnce } from "./worker-runner";

export {
  createMediaProcessingPlan,
  maxUploadBytes,
  maxVideoDurationSeconds,
  validateMediaCandidate
} from "./media-processing";
export {
  buildNormalizationArguments,
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
  const backend = new SupabaseMediaWorkerBackend(
    config.supabaseUrl,
    config.serviceRoleKey
  );
  if (mode === "--once") {
    const result = await runWorkerOnce({ backend, config });
    console.log(JSON.stringify(result));
    if (result.status === "failed") process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await runWorkerLoop({
      backend,
      config,
      onResult: (result) => console.log(JSON.stringify(result)),
      signal: controller.signal
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "worker_unhandled_error";
    console.error(JSON.stringify({
      code,
      message: error instanceof Error ? error.message : "Onbekende workerfout.",
      service: VEYOCAST_APPS["media-worker"].name,
      status: "error"
    }));
    process.exitCode = 1;
  });
}
