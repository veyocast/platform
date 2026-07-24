import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio
} from "node:child_process";
import { open } from "node:fs/promises";
import { once } from "node:events";

import { studioFps, type StudioDocument } from "@veyocast/studio";

import {
  throwIfAborted,
  type StudioExternalRenderer
} from "./studio-render-image";
import {
  renderStudioSvg,
  type StudioSvgAssetSources
} from "./studio-render-svg";
import {
  runCommand,
  type CommandRunner
} from "./video-normalization";

export const maximumStudioEncodingTimeMs = 55_000;
const maximumCapturedErrorBytes = 1024 * 1024;

export type StudioVideoProbe = {
  audioStreamCount: number;
  durationSeconds: number;
  formatNames: string[];
  framesPerSecond: number;
  height: number;
  pixelFormat: string;
  readFrameCount: number;
  videoCodec: string;
  videoStreamCount: number;
  width: number;
};

export type StudioSpawn = (
  executable: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio & {
    shell: false;
    stdio: ["pipe", "pipe", "pipe"];
  }
) => ChildProcessWithoutNullStreams;

export class StudioVideoRenderError extends Error {
  constructor(
    readonly code:
      | "encoding_failed"
      | "encoding_timeout"
      | "frame_invalid"
      | "mp4_faststart_missing"
      | "mp4_invalid"
      | "render_cancelled",
    message: string
  ) {
    super(message);
    this.name = "StudioVideoRenderError";
  }
}

export function studioFrameCount(durationMs: number) {
  return Math.max(1, Math.round((durationMs / 1_000) * studioFps));
}

export function buildStudioMp4Arguments({
  frameCount,
  height,
  outputPath,
  width
}: {
  frameCount: number;
  height: number;
  outputPath: string;
  width: number;
}) {
  return [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-video_size", `${width}x${height}`,
    "-framerate", String(studioFps),
    "-i", "pipe:0",
    "-frames:v", String(frameCount),
    "-map", "0:v:0",
    "-an",
    "-c:v", "libx264",
    "-profile:v", "main",
    "-level:v", "4.0",
    "-preset", "veryfast",
    "-crf", "21",
    "-maxrate", "6M",
    "-bufsize", "12M",
    "-pix_fmt", "yuv420p",
    "-g", String(studioFps),
    "-keyint_min", String(studioFps),
    "-sc_threshold", "0",
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    "-f", "mp4",
    outputPath
  ] as const;
}

export async function encodeStudioMp4({
  assetSources,
  document,
  onFrame,
  outputPath,
  renderer,
  signal,
  spawnProcess = spawn as StudioSpawn,
  timeoutMs = maximumStudioEncodingTimeMs
}: {
  assetSources?: StudioSvgAssetSources;
  document: StudioDocument;
  onFrame?: (frameIndex: number, frameCount: number) => Promise<void> | void;
  outputPath: string;
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
  spawnProcess?: StudioSpawn;
  timeoutMs?: number;
}) {
  throwIfAborted(signal);
  const { height, width } = document.artboard;
  const frameCount = studioFrameCount(document.motion.durationMs);
  const expectedFrameBytes = width * height * 4;
  const child = spawnProcess(
    "ffmpeg",
    buildStudioMp4Arguments({ frameCount, height, outputPath, width }),
    { shell: false, stdio: ["pipe", "pipe", "pipe"] }
  );
  const completion = waitForEncoder(child, timeoutMs, signal);

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      throwIfAborted(signal);
      await onFrame?.(frameIndex, frameCount);
      const timeMs = frameIndex * (1_000 / studioFps);
      const svg = renderStudioSvg({ assetSources, document, timeMs });
      const frame = Buffer.from(await renderer.renderRgba({
        height,
        signal,
        svg,
        width
      }));
      if (frame.byteLength !== expectedFrameBytes) {
        throw new StudioVideoRenderError(
          "frame_invalid",
          `RGBA-frame bevat ${frame.byteLength} bytes; verwacht ${expectedFrameBytes}.`
        );
      }
      if (!child.stdin.write(frame)) {
        await once(child.stdin, "drain");
      }
    }
    child.stdin.end();
    await completion;
    return { frameCount, outputPath };
  } catch (error) {
    child.kill("SIGKILL");
    await completion.catch(() => undefined);
    if (signal?.aborted) {
      throw new StudioVideoRenderError(
        "render_cancelled",
        "Studio-video-render is geannuleerd."
      );
    }
    if (error instanceof StudioVideoRenderError) throw error;
    throw new StudioVideoRenderError(
      "encoding_failed",
      error instanceof Error
        ? safeCommandMessage(error.message)
        : "FFmpeg-encoding is mislukt."
    );
  } finally {
    child.stdin.destroy();
  }
}

export async function probeAndValidateStudioMp4({
  durationMs,
  expectedHeight,
  expectedWidth,
  inputPath,
  runner = runCommand
}: {
  durationMs: number;
  expectedHeight: number;
  expectedWidth: number;
  inputPath: string;
  runner?: CommandRunner;
}) {
  const result = await runner("ffprobe", [
    "-v", "error",
    "-count_frames",
    "-show_entries",
    "format=format_name,duration:stream=codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,nb_read_frames",
    "-of", "json",
    inputPath
  ]);
  const probe = parseStudioVideoProbe(result.stdout);
  validateStudioVideoProbe(probe, {
    durationMs,
    height: expectedHeight,
    width: expectedWidth
  });
  if (!await inspectMp4FastStart(inputPath)) {
    throw new StudioVideoRenderError(
      "mp4_faststart_missing",
      "Studio-MP4 bevat de moov-atom niet vóór de mediadataset."
    );
  }
  return probe;
}

export function parseStudioVideoProbe(serializedProbe: string): StudioVideoProbe {
  let value: unknown;
  try {
    value = JSON.parse(serializedProbe);
  } catch {
    throw invalidMp4("FFprobe gaf geen geldige JSON terug.");
  }
  if (!isRecord(value) || !isRecord(value.format) || !Array.isArray(value.streams)) {
    throw invalidMp4("FFprobe-uitvoer mist format- of streaminformatie.");
  }
  const streams = value.streams.filter(isRecord);
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  const video = videoStreams[0];
  if (!video) throw invalidMp4("Studio-MP4 bevat geen videostream.");
  const durationSeconds = positiveNumber(value.format.duration);
  const width = positiveInteger(video.width);
  const height = positiveInteger(video.height);
  const framesPerSecond = frameRate(video.avg_frame_rate);
  const readFrameCount = positiveInteger(video.nb_read_frames);
  const formatName = nonEmptyString(value.format.format_name);
  const videoCodec = nonEmptyString(video.codec_name);
  const pixelFormat = nonEmptyString(video.pix_fmt);
  if (
    durationSeconds === null ||
    width === null ||
    height === null ||
    framesPerSecond === null ||
    readFrameCount === null ||
    !formatName ||
    !videoCodec ||
    !pixelFormat
  ) {
    throw invalidMp4("Studio-MP4 bevat onvolledige metadata.");
  }
  return {
    audioStreamCount: audioStreams.length,
    durationSeconds,
    formatNames: formatName.split(",").map((entry) => entry.trim()),
    framesPerSecond,
    height,
    pixelFormat,
    readFrameCount,
    videoCodec,
    videoStreamCount: videoStreams.length,
    width
  };
}

export function validateStudioVideoProbe(
  probe: StudioVideoProbe,
  expected: { durationMs: number; height: number; width: number }
) {
  const expectedFrames = studioFrameCount(expected.durationMs);
  const expectedDuration = expectedFrames / studioFps;
  const failures = [
    !probe.formatNames.some((name) => name === "mov" || name === "mp4") &&
      "MP4-container ontbreekt",
    probe.videoStreamCount !== 1 && "bestand bevat niet precies één videostream",
    probe.audioStreamCount !== 0 && "bestand bevat een audiostream",
    probe.videoCodec !== "h264" && "videocodec is niet H.264",
    probe.pixelFormat !== "yuv420p" && "pixel format is niet yuv420p",
    probe.width !== expected.width && "breedte wijkt af",
    probe.height !== expected.height && "hoogte wijkt af",
    Math.abs(probe.framesPerSecond - studioFps) > 0.001 && "framerate is niet 30 fps",
    probe.readFrameCount !== expectedFrames && "frameaantal wijkt af",
    Math.abs(probe.durationSeconds - expectedDuration) > 1 / studioFps + 0.001 &&
      "videoduur wijkt af"
  ].filter(Boolean);
  if (failures.length > 0) {
    throw invalidMp4(
      `Studio-MP4 voldoet niet aan het contract: ${failures.join(", ")}.`
    );
  }
}

export async function inspectMp4FastStart(inputPath: string) {
  const handle = await open(inputPath, "r");
  try {
    const file = await handle.stat();
    let offset = 0;
    let atoms = 0;
    while (offset + 8 <= file.size && atoms < 10_000) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) return false;
      let atomSize = header.readUInt32BE(0);
      const atomType = header.toString("ascii", 4, 8);
      let headerSize = 8;
      if (atomSize === 1) {
        if (bytesRead < 16) return false;
        const extendedSize = header.readBigUInt64BE(8);
        if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        atomSize = Number(extendedSize);
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = file.size - offset;
      }
      if (atomSize < headerSize || offset + atomSize > file.size) return false;
      if (atomType === "moov") return true;
      if (atomType === "mdat") return false;
      offset += atomSize;
      atoms += 1;
    }
    return false;
  } finally {
    await handle.close();
  }
}

function waitForEncoder(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
  signal?: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectOnce(new StudioVideoRenderError(
        "encoding_timeout",
        "Studio-encoding overschreed de tijdslimiet."
      ));
    }, timeoutMs);
    const abort = () => {
      child.kill("SIGKILL");
      rejectOnce(new StudioVideoRenderError(
        "render_cancelled",
        "Studio-video-render is geannuleerd."
      ));
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stderr) >= maximumCapturedErrorBytes) return;
      stderr = (stderr + chunk.toString("utf8")).slice(
        0,
        maximumCapturedErrorBytes
      );
    });
    child.on("error", (error) => {
      rejectOnce(new StudioVideoRenderError(
        "encoding_failed",
        `Kon FFmpeg niet starten: ${safeCommandMessage(error.message)}`
      ));
    });
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolveOnce();
        return;
      }
      rejectOnce(new StudioVideoRenderError(
        "encoding_failed",
        `FFmpeg stopte met code ${exitCode}: ${safeCommandMessage(stderr)}`
      ));
    });

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
    function resolveOnce() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }
    function rejectOnce(error: StudioVideoRenderError) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

function invalidMp4(message: string) {
  return new StudioVideoRenderError("mp4_invalid", message);
}

function safeCommandMessage(message: string) {
  return message.replace(/[\r\n]+/g, " ").slice(0, 500) || "geen foutdetails";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function positiveNumber(value: unknown) {
  const number = typeof value === "string" || typeof value === "number"
    ? Number(value)
    : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: unknown) {
  const number = positiveNumber(value);
  return number !== null && Number.isSafeInteger(number) ? number : null;
}

function frameRate(value: unknown) {
  if (typeof value !== "string") return null;
  const [numerator, denominator = "1"] = value.split("/");
  const numeratorValue = Number(numerator);
  const denominatorValue = Number(denominator);
  if (
    !Number.isFinite(numeratorValue) ||
    !Number.isFinite(denominatorValue) ||
    denominatorValue <= 0
  ) {
    return null;
  }
  const result = numeratorValue / denominatorValue;
  return result > 0 ? result : null;
}
