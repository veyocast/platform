import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";

import {
  studioFps,
  studioRenderResultSchema,
  type StudioRenderResult
} from "@veyocast/studio";

import {
  StudioRenderBackendError,
  studioRenderArtifactPaths,
  type ClaimedStudioRenderJob,
  type StudioRenderBackend
} from "./studio-render-backend";
import {
  renderStudioPng,
  StudioImageRenderError,
  type StudioExternalRenderer
} from "./studio-render-image";
import {
  StudioSvgRenderError,
  type StudioSvgAssetSource
} from "./studio-render-svg";
import {
  encodeStudioMp4,
  probeAndValidateStudioMp4,
  renderStudioVideoPoster,
  type StudioBackgroundVideo,
  StudioVideoRenderError
} from "./studio-render-video";
import { maxUploadBytes } from "./media-processing";

export type StudioRenderWorkerConfig = {
  lockTimeoutSeconds: number;
  maxAttempts: number;
  workerId: string;
};

export const maximumStudioInlineAssetBytes = 64 * 1024 * 1024;

export type StudioRenderRunResult =
  | { status: "idle" }
  | { jobId: string; mediaAssetId: string; status: "completed" }
  | {
      errorCode: string;
      jobId: string;
      mediaAssetId: string;
      status: "cancelled" | "failed" | "lease_lost" | "retry_scheduled";
    };

type StudioMp4Encoder = typeof encodeStudioMp4;
type StudioMp4Validator = typeof probeAndValidateStudioMp4;

export class StudioRenderJobError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "StudioRenderJobError";
  }
}

export class StudioRenderRunFatalError extends Error {
  readonly code = "studio_render_state_update_failed";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "StudioRenderRunFatalError";
  }
}

export async function runStudioRenderOnce({
  backend,
  config,
  encodeMp4 = encodeStudioMp4,
  renderer,
  signal,
  validateMp4 = probeAndValidateStudioMp4
}: {
  backend: StudioRenderBackend;
  config: StudioRenderWorkerConfig;
  encodeMp4?: StudioMp4Encoder;
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
  validateMp4?: StudioMp4Validator;
}): Promise<StudioRenderRunResult> {
  const job = await backend.claimJob(
    config.workerId,
    config.lockTimeoutSeconds,
    config.maxAttempts
  );
  if (!job) return { status: "idle" };

  try {
    return await withStudioRenderTempDirectory(async (workingDirectory) => {
      const preparedAssets = await prepareStudioAssets({
        backend,
        config,
        job,
        renderer,
        signal,
        workingDirectory
      });
      const { assetSources, backgroundVideo } = preparedAssets;
      const paths = studioRenderArtifactPaths(job);
      const outputPath = join(
        workingDirectory,
        `studio-output.${job.outputType}`
      );
      const posterPath = join(workingDirectory, "studio-poster.png");
      const update = (input: Parameters<StudioRenderBackend["updateJob"]>[0]) =>
        updateAndAssertLease(backend, input);

      await assertLease(await backend.updateJob({
        jobId: job.jobId,
        progress: 20,
        status: "rendering",
        workerId: config.workerId
      }));

      let durationMs = 0;
      if (job.outputType === "png") {
        const png = backgroundVideo
          ? await renderAndNormalizeStudioVideoPoster({
              assetSources,
              backgroundVideo,
              document: job.document,
              renderer,
              signal,
              workingDirectory
            })
          : await renderStudioPng({
              assetSources,
              document: job.document,
              renderer,
              signal
            });
        await Promise.all([
          writeFile(outputPath, png, { flag: "wx" }),
          writeFile(posterPath, png, { flag: "wx" })
        ]);
      } else {
        const encoded = await encodeMp4({
          assetSources,
          backgroundVideo,
          document: job.document,
          onFrame: async (frameIndex, frameCount) => {
            if (frameIndex % studioFps !== 0) return;
            await update({
              jobId: job.jobId,
              progress: 20 + Math.floor((frameIndex / frameCount) * 55),
              status: "rendering",
              workerId: config.workerId
            });
          },
          outputPath,
          renderer,
          signal
        });
        durationMs = Math.round((encoded.frameCount / studioFps) * 1_000);
        await assertLease(await backend.updateJob({
          jobId: job.jobId,
          progress: 78,
          status: "encoding",
          workerId: config.workerId
        }));
        await validateMp4({
          durationMs: job.document.motion.durationMs,
          expectedHeight: job.document.artboard.height,
          expectedWidth: job.document.artboard.width,
          inputPath: outputPath
        });
        const poster = backgroundVideo
          ? await renderAndNormalizeStudioVideoPoster({
              assetSources,
              backgroundVideo,
              document: job.document,
              renderer,
              signal,
              workingDirectory
            })
          : await renderStudioPng({
              assetSources,
              document: job.document,
              renderer,
              signal
            });
        await writeFile(posterPath, poster, { flag: "wx" });
      }

      await assertLease(await backend.updateJob({
        jobId: job.jobId,
        progress: 85,
        status: "uploading",
        workerId: config.workerId
      }));
      await backend.uploadArtifact(
        job,
        outputPath,
        paths.output,
        job.outputType === "png" ? "image/png" : "video/mp4"
      );
      await backend.uploadArtifact(
        job,
        posterPath,
        paths.poster,
        "image/png"
      );
      const [output, poster] = await Promise.all([
        artifactMetadata(outputPath),
        artifactMetadata(posterPath)
      ]);
      const result = studioRenderResultSchema.parse({
        checksumSha256: output.checksum,
        durationMs,
        fileSizeBytes: output.size,
        height: job.document.artboard.height,
        mimeType: job.outputType === "png" ? "image/png" : "video/mp4",
        posterChecksumSha256: poster.checksum,
        posterFileSizeBytes: poster.size,
        width: job.document.artboard.width
      }) as StudioRenderResult;

      await assertLease(await backend.updateJob({
        jobId: job.jobId,
        progress: 95,
        status: "creating_media",
        workerId: config.workerId
      }));
      await backend.completeJob({
        jobId: job.jobId,
        outputStoragePath: paths.output,
        posterStoragePath: paths.poster,
        result,
        workerId: config.workerId
      });
      return {
        jobId: job.jobId,
        mediaAssetId: job.mediaAssetId,
        status: "completed"
      };
    });
  } catch (error) {
    const failure = classifyStudioRenderFailure(error);
    if (failure.code === "studio_lease_lost") {
      return {
        errorCode: failure.code,
        jobId: job.jobId,
        mediaAssetId: job.mediaAssetId,
        status: "lease_lost"
      };
    }
    let reported: "cancelled" | "failed" | "queued";
    try {
      reported = await backend.failJob({
        errorCode: failure.code,
        errorMessage: failure.message,
        jobId: job.jobId,
        retryable: failure.retryable,
        workerId: config.workerId
      });
    } catch (reportingError) {
      throw new StudioRenderRunFatalError(
        "Studio-render mislukte en de foutstatus kon niet worden opgeslagen.",
        reportingError
      );
    }
    return {
      errorCode: failure.code,
      jobId: job.jobId,
      mediaAssetId: job.mediaAssetId,
      status: reported === "queued" ? "retry_scheduled" : reported
    };
  }
}

export async function runStudioRenderLoop({
  backend,
  config,
  intervalMs,
  onQueuePoll = () => undefined,
  onResult = () => undefined,
  renderer,
  signal,
  waitForWork
}: {
  backend: StudioRenderBackend;
  config: StudioRenderWorkerConfig;
  intervalMs: number;
  onQueuePoll?: () => void;
  onResult?: (result: StudioRenderRunResult) => void;
  renderer: StudioExternalRenderer;
  signal: AbortSignal;
  waitForWork?: (signal: AbortSignal) => Promise<void>;
}) {
  while (!signal.aborted) {
    if (waitForWork) await waitForWork(signal);
    if (signal.aborted) break;
    const result = await runStudioRenderOnce({
      backend,
      config,
      renderer,
      signal
    });
    onQueuePoll();
    onResult(result);
    if (result.status === "idle" && !waitForWork) {
      await abortableStudioDelay(intervalMs, signal);
    }
  }
}

export async function withStudioRenderTempDirectory<T>(
  callback: (workingDirectory: string) => Promise<T>
) {
  const workingDirectory = await mkdtemp(
    join(tmpdir(), "veyocast-studio-render-")
  );
  try {
    return await callback(workingDirectory);
  } finally {
    await rm(workingDirectory, { force: true, recursive: true });
  }
}

export function studioRenderRetryDelaySeconds(attemptCount: number) {
  const boundedAttempt = Math.max(1, Math.min(7, Math.floor(attemptCount)));
  return Math.min(300, 5 * 2 ** (boundedAttempt - 1));
}

export function classifyStudioRenderFailure(error: unknown) {
  if (error instanceof StudioRenderJobError) return error;
  if (error instanceof StudioRenderBackendError) {
    return new StudioRenderJobError(
      error.code,
      error.retryable,
      safeMessage(error.message)
    );
  }
  if (error instanceof StudioImageRenderError) {
    return new StudioRenderJobError(
      error.code,
      error.code !== "png_invalid" &&
        error.code !== "png_profile_invalid" &&
        error.code !== "renderer_output_invalid" &&
        error.code !== "render_cancelled",
      safeMessage(error.message)
    );
  }
  if (error instanceof StudioVideoRenderError) {
    return new StudioRenderJobError(
      error.code,
      error.code === "encoding_failed" || error.code === "encoding_timeout",
      safeMessage(error.message)
    );
  }
  if (error instanceof StudioSvgRenderError) {
    return new StudioRenderJobError(
      error.code,
      false,
      safeMessage(error.message)
    );
  }
  return new StudioRenderJobError(
    "studio_render_internal_error",
    true,
    "Studio-render is door een interne workerfout onderbroken."
  );
}

async function prepareStudioAssets({
  backend,
  config,
  job,
  renderer,
  signal,
  workingDirectory
}: {
  backend: StudioRenderBackend;
  config: StudioRenderWorkerConfig;
  job: ClaimedStudioRenderJob;
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
  workingDirectory: string;
}) {
  await assertLease(await backend.updateJob({
    jobId: job.jobId,
    progress: 2,
    status: "preparing",
    workerId: config.workerId
  }));
  const sources: Record<string, StudioSvgAssetSource> = {};
  let backgroundVideo: StudioBackgroundVideo | undefined;
  let inlineAssetBytes = 0;
  for (const [index, asset] of job.sourceAssets.entries()) {
    if (signal?.aborted) {
      throw new StudioRenderJobError(
        "render_cancelled",
        false,
        "Studio-render is geannuleerd."
      );
    }
    const extension = safeAssetExtension(asset.mimeType, asset.path);
    const destination = join(
      workingDirectory,
      `asset-${String(index).padStart(3, "0")}${extension}`
    );
    await backend.downloadAsset(job, asset, destination);
    const downloaded = await stat(destination);
    if (!downloaded.isFile() || downloaded.size > maxUploadBytes) {
      throw new StudioRenderJobError(
        "studio_asset_too_large",
        false,
        "Studio-bronbestand overschrijdt de maximale bestandsgrootte."
      );
    }
    await assertStudioAssetMagic(destination, asset.mimeType);
    if (await sha256File(destination) !== asset.checksumSha256) {
      throw new StudioRenderJobError(
        "studio_asset_checksum_mismatch",
        false,
        `Checksum van Studio-bron ${asset.assetId} wijkt af.`
      );
    }
    if (asset.width === null || asset.height === null) {
      throw new StudioRenderJobError(
        "studio_asset_dimensions_missing",
        false,
        "Studio-bronbestand mist gevalideerde afbeeldingsafmetingen."
      );
    }
    if (asset.mimeType === "video/mp4") {
      const element = job.document.elements.find(
        (candidate) =>
          candidate.type === "video" && candidate.mediaAssetId === asset.assetId
      );
      if (!element || element.type !== "video") {
        throw new StudioRenderJobError(
          "studio_asset_binding_invalid",
          false,
          "Studio-videobron is niet aan de documentachtergrond gekoppeld."
        );
      }
      backgroundVideo = {
        focusX: element.focusX,
        focusY: element.focusY,
        objectFit: element.objectFit,
        path: destination,
        startOffsetMs: element.startOffsetMs
      };
    } else {
      inlineAssetBytes += downloaded.size;
      if (inlineAssetBytes > maximumStudioInlineAssetBytes) {
        throw new StudioRenderJobError(
          "studio_assets_too_large",
          false,
          "Studio-afbeeldingsbronnen zijn samen te groot voor een veilige render."
        );
      }
      const source =
        `data:${asset.mimeType};base64,${(await readFile(destination)).toString("base64")}`;
      for (const element of job.document.elements) {
        if (element.type === "image" && element.mediaAssetId === asset.assetId) {
          sources[element.id] = {
            height: asset.height,
            href: source,
            width: asset.width
          };
        }
      }
    }
    await assertLease(await backend.updateJob({
      jobId: job.jobId,
      progress: 3 + Math.floor(((index + 1) / job.sourceAssets.length) * 14),
      status: "preparing",
      workerId: config.workerId
    }));
  }
  for (const element of job.document.elements) {
    if (element.type !== "qr") continue;
    if (!renderer.renderQrSvgDataUri) {
      throw new StudioRenderJobError(
        "studio_qr_renderer_missing",
        false,
        "De geconfigureerde Studio-renderer ondersteunt geen QR-elementen."
      );
    }
    sources[element.id] = await renderer.renderQrSvgDataUri({
      background: element.background,
      errorCorrection: element.errorCorrection,
      foreground: element.foreground,
      value: element.value
    });
  }
  return { assetSources: sources, backgroundVideo };
}

async function renderAndNormalizeStudioVideoPoster({
  assetSources,
  backgroundVideo,
  document,
  renderer,
  signal,
  workingDirectory
}: {
  assetSources: Record<string, StudioSvgAssetSource>;
  backgroundVideo: StudioBackgroundVideo;
  document: ClaimedStudioRenderJob["document"];
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
  workingDirectory: string;
}) {
  const rawPath = join(
    workingDirectory,
    "studio-video-poster-raw.png"
  );
  await renderStudioVideoPoster({
    assetSources,
    backgroundVideo,
    document,
    outputPath: rawPath,
    renderer,
    signal
  });
  const normalized = await sharp(rawPath, { failOn: "error" })
    .withIccProfile("srgb")
    .png({
      adaptiveFiltering: false,
      compressionLevel: 9,
      palette: false,
      progressive: false
    })
    .toBuffer();
  await rm(rawPath, { force: true });
  return normalized;
}

function assertLease(
  state: Awaited<ReturnType<StudioRenderBackend["updateJob"]>>
) {
  if (!state.leaseValid) {
    throw new StudioRenderJobError(
      "studio_lease_lost",
      false,
      "Studio-renderlease is niet langer geldig."
    );
  }
  if (state.cancelRequested) {
    throw new StudioRenderJobError(
      "render_cancelled",
      false,
      "Studio-render is door de gebruiker geannuleerd."
    );
  }
}

async function updateAndAssertLease(
  backend: StudioRenderBackend,
  input: Parameters<StudioRenderBackend["updateJob"]>[0]
) {
  assertLease(await backend.updateJob(input));
}

async function artifactMetadata(path: string) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size <= 0) {
    throw new StudioRenderJobError(
      "studio_artifact_empty",
      false,
      "Studio-renderer leverde geen geldig bestand op."
    );
  }
  return {
    checksum: await sha256File(path),
    size: metadata.size
  };
}

async function sha256File(path: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

function safeAssetExtension(mimeType: string, storagePath: string) {
  const expected = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4"
  }[mimeType];
  if (!expected) {
    throw new StudioRenderJobError(
      "studio_asset_mime_unsupported",
      false,
      "Studio-bron gebruikt een niet-ondersteund mediatype."
    );
  }
  const sourceExtension = extname(storagePath).toLowerCase();
  return sourceExtension === ".jpeg" && expected === ".jpg"
    ? ".jpeg"
    : expected;
}

async function assertStudioAssetMagic(
  path: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4"
) {
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const valid = mimeType === "video/mp4"
      ? bytesRead >= 12 && header.toString("ascii", 4, 8) === "ftyp"
      : mimeType === "image/png"
      ? bytesRead >= 8 &&
        header.subarray(0, 8).equals(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        )
      : mimeType === "image/jpeg"
        ? bytesRead >= 3 &&
          header[0] === 0xff &&
          header[1] === 0xd8 &&
          header[2] === 0xff
        : bytesRead >= 12 &&
          header.toString("ascii", 0, 4) === "RIFF" &&
          header.toString("ascii", 8, 12) === "WEBP";
    if (!valid) {
      throw new StudioRenderJobError(
        "studio_asset_signature_invalid",
        false,
        "Studio-bronbestand komt niet overeen met het opgegeven MIME-type."
      );
    }
  } finally {
    await handle.close();
  }
}

function safeMessage(message: string) {
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function abortableStudioDelay(milliseconds: number, signal: AbortSignal) {
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
