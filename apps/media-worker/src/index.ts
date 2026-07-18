import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";

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

export type WorkerHealth = {
  service: string;
  status: "ok";
  checkedAt: string;
  controlUrl: string;
};

export function getWorkerHealth(now = new Date()): WorkerHealth {
  return {
    service: CASTIVO_APPS["media-worker"].name,
    status: "ok",
    checkedAt: now.toISOString(),
    controlUrl: getLocalUrl("control")
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  console.log(JSON.stringify(getWorkerHealth(), null, 2));
}
