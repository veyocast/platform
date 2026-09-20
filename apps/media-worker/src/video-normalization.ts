import { spawn } from "node:child_process";

import { maxVideoDurationSeconds } from "./media-processing";

export type CommandResult = { stderr: string; stdout: string };
export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options?: { timeoutMs?: number }
) => Promise<CommandResult>;

export type VideoProbe = {
  audioCodec: string | null;
  containerBitrate?: number;
  durationSeconds: number;
  formatNames: string[];
  framesPerSecond: number;
  height: number;
  pixelFormat: string | null;
  rotationDegrees: number;
  sampleAspectRatio?: string;
  videoCodec: string;
  videoProfile?: string | null;
  videoLevel?: number | null;
  width: number;
};

export type VideoNormalizationResult = {
  input: VideoProbe;
  output: VideoProbe;
  outputPath: string;
};

export type PlayerVideoDimensions = {
  height: number;
  width: number;
};

export class VideoProcessingError extends Error {
  constructor(
    readonly code:
      | "command_failed"
      | "invalid_probe"
      | "normalization_failed"
      | "processing_timeout"
      | "unsupported_input",
    message: string
  ) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

const maximumCapturedOutputBytes = 5 * 1024 * 1024;
export const maximumNormalizationTimeMs = 40_000;

export async function probeVideoFile(
  inputPath: string,
  runner: CommandRunner = runCommand
): Promise<VideoProbe> {
  const result = await runner("ffprobe", [
    "-v", "error", "-show_entries",
    "format=format_name,duration,bit_rate:stream=codec_type,codec_name,profile,level,width,height,r_frame_rate,pix_fmt,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation",
    "-of", "json", inputPath
  ]);
  return parseVideoProbe(result.stdout);
}

export async function normalizePlayerVideo({
  inputPath,
  outputPath,
  runner = runCommand
}: {
  inputPath: string;
  outputPath: string;
  runner?: CommandRunner;
}): Promise<VideoNormalizationResult> {
  const input = await probeVideoFile(inputPath, runner);
  validateInputProbe(input);

  try {
    await runner("ffmpeg", buildNormalizationArguments(inputPath, outputPath, input), {
      timeoutMs: maximumNormalizationTimeMs
    });
  } catch (error) {
    if (error instanceof VideoProcessingError) throw error;
    throw new VideoProcessingError(
      "normalization_failed",
      error instanceof Error ? error.message : "FFmpeg-normalisatie is mislukt."
    );
  }

  const output = await probeVideoFile(outputPath, runner);
  validatePlayerVariant(output);
  return { input, output, outputPath };
}

export async function createPlayerVideoPoster({
  inputPath,
  outputPath,
  runner = runCommand
}: {
  inputPath: string;
  outputPath: string;
  runner?: CommandRunner;
}) {
  await runner("ffmpeg", [
    "-hide_banner", "-nostdin", "-y",
    "-ss", "0.5", "-i", inputPath,
    "-map", "0:v:0", "-frames:v", "1",
    "-vf", "thumbnail,scale=w='if(gte(iw,ih),min(1920,iw),min(1080,iw))':h='if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos",
    "-an", "-f", "image2", outputPath
  ], { timeoutMs: maximumNormalizationTimeMs });
  return outputPath;
}

export function buildNormalizationArguments(
  inputPath: string,
  outputPath: string,
  input?: VideoProbe
) {
  const codecArguments = input && canRemuxWithoutTranscoding(input)
    ? ["-c:v", "copy"]
    : [
      "-vf", "scale=w='if(gte(iw,ih),min(1920,iw),min(1080,iw))':h='if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1,fps=30",
      "-c:v", "libx264", "-profile:v", "main", "-level:v", "4.0",
      "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "21",
      "-maxrate", "6M", "-bufsize", "12M"
    ];
  return [
    "-hide_banner", "-nostdin", "-y", "-i", inputPath,
    "-map", "0:v:0",
    ...codecArguments,
    "-an",
    "-metadata:s:v:0", "rotate=0",
    "-movflags", "+faststart", "-f", "mp4", outputPath
  ] as const;
}

export function canRemuxWithoutTranscoding(probe: VideoProbe) {
  const canonicalDimensions = getCanonicalPlayerDimensions(probe.width, probe.height);
  return typeof probe.containerBitrate === "number" && probe.containerBitrate > 0 && probe.containerBitrate <= 6_000_000
    && probe.videoCodec === "h264"
    && ["constrained baseline", "baseline", "main", "high"].includes(probe.videoProfile ?? "")
    && typeof probe.videoLevel === "number" && probe.videoLevel <= 40
    && (probe.audioCodec === null || probe.audioCodec === "aac")
    && probe.width === canonicalDimensions.width
    && probe.height === canonicalDimensions.height
    && probe.framesPerSecond <= 30.01
    && probe.pixelFormat === "yuv420p"
    && probe.rotationDegrees === 0;
}

export function getCanonicalPlayerDimensions(
  width: number,
  height: number
): PlayerVideoDimensions {
  const maximumWidth = width >= height ? 1920 : 1080;
  const maximumHeight = width >= height ? 1080 : 1920;
  const scale = Math.min(1, maximumWidth / width, maximumHeight / height);
  return {
    height: Math.max(2, Math.floor((height * scale) / 2) * 2),
    width: Math.max(2, Math.floor((width * scale) / 2) * 2)
  };
}

export function parseVideoProbe(serializedProbe: string): VideoProbe {
  let value: unknown;
  try {
    value = JSON.parse(serializedProbe);
  } catch {
    throw new VideoProcessingError("invalid_probe", "FFprobe gaf geen geldige JSON terug.");
  }
  if (!isRecord(value) || !isRecord(value.format) || !Array.isArray(value.streams)) {
    throw new VideoProcessingError("invalid_probe", "FFprobe-uitvoer mist format- of streaminformatie.");
  }

  const videoStream = value.streams.find(
    (stream) => isRecord(stream) && stream.codec_type === "video"
  );
  const audioStream = value.streams.find(
    (stream) => isRecord(stream) && stream.codec_type === "audio"
  );
  if (!isRecord(videoStream)) {
    throw new VideoProcessingError("invalid_probe", "Het bestand bevat geen videostream.");
  }

  const durationSeconds = toFiniteNumber(value.format.duration);
  const width = toPositiveInteger(videoStream.width);
  const height = toPositiveInteger(videoStream.height);
  const videoCodec = toNonEmptyString(videoStream.codec_name);
  const formatName = toNonEmptyString(value.format.format_name);
  const framesPerSecond = parseFrameRate(videoStream.r_frame_rate);
  const rotationDegrees = parseRotationDegrees(videoStream);
  if (!durationSeconds || !width || !height || !videoCodec || !formatName || !framesPerSecond) {
    throw new VideoProcessingError("invalid_probe", "Videometadata is incompleet of ongeldig.");
  }

  return {
    ...(toPositiveInteger(value.format.bit_rate) ? { containerBitrate: toPositiveInteger(value.format.bit_rate)! } : {}),
    audioCodec: isRecord(audioStream) ? toNonEmptyString(audioStream.codec_name) : null,
    durationSeconds,
    formatNames: formatName.split(",").map((name) => name.trim()),
    framesPerSecond,
    height,
    pixelFormat: toNonEmptyString(videoStream.pix_fmt),
    rotationDegrees,
    ...(typeof videoStream.sample_aspect_ratio === "string" ? { sampleAspectRatio: videoStream.sample_aspect_ratio } : {}),
    videoCodec,
    videoProfile: toNonEmptyString(videoStream.profile),
    videoLevel: toPositiveInteger(videoStream.level),
    width
  };
}

export function validateInputProbe(probe: VideoProbe) {
  if (!probe.formatNames.some((name) =>
    name === "gif" || name === "mov" || name === "mp4" || name === "matroska" || name === "webm"
  )) {
    throw new VideoProcessingError("unsupported_input", "Alleen GIF, MP4 of WebM wordt verwerkt.");
  }
  if (probe.formatNames.includes("gif") && probe.durationSeconds > 60) {
    throw new VideoProcessingError("unsupported_input", "Een GIF mag maximaal 60 seconden duren.");
  }
  if (probe.durationSeconds > maxVideoDurationSeconds) {
    throw new VideoProcessingError(
      "unsupported_input",
      `Video duurt langer dan ${maxVideoDurationSeconds} seconden.`
    );
  }
}

export function validatePlayerVariant(probe: VideoProbe) {
  const canonicalDimensions = getCanonicalPlayerDimensions(probe.width, probe.height);
  const failures = [
    !probe.formatNames.some((name) => name === "mov" || name === "mp4") && "MP4-container ontbreekt",
    probe.videoCodec !== "h264" && "videocodec is niet H.264",
    probe.audioCodec !== null && "deliveryvariant bevat nog audio",
    (
      Math.max(probe.width, probe.height) > 1920 ||
      Math.min(probe.width, probe.height) > 1080
    ) && "resolutie is groter dan 1080p",
    (
      probe.width !== canonicalDimensions.width ||
      probe.height !== canonicalDimensions.height
    ) && "resolutie voldoet niet aan het begrensde even raster",
    probe.framesPerSecond > 30.01 && "framerate is hoger dan 30 fps",
    probe.pixelFormat !== "yuv420p" && "pixel format is niet yuv420p",
    probe.rotationDegrees !== 0 && "rotatiemetadata is niet in pixels verwerkt",
    probe.durationSeconds > maxVideoDurationSeconds && "video is langer dan vijf minuten"
  ].filter(Boolean);
  if (failures.length > 0) {
    throw new VideoProcessingError(
      "normalization_failed",
      `Playervariant voldoet niet aan het contract: ${failures.join(", ")}.`
    );
  }
}

export function runCommand(
  executable: string,
  args: readonly string[],
  options: { timeoutMs?: number } = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finishReject(
        `Commando ${executable} overschreed de tijdslimiet.`,
        "processing_timeout"
      );
    }, options.timeoutMs ?? maximumNormalizationTimeMs);

    function append(current: string, chunk: Buffer) {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next) > maximumCapturedOutputBytes) {
        child.kill("SIGKILL");
        finishReject(`Uitvoer van ${executable} overschreed de veiligheidslimiet.`);
      }
      return next;
    }
    function finishReject(
      message: string,
      code: "command_failed" | "processing_timeout" = "command_failed"
    ) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new VideoProcessingError(code, message));
    }

    child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => finishReject(`Kon ${executable} niet starten: ${error.message}`));
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (exitCode !== 0) {
        reject(new VideoProcessingError(
          "command_failed",
          `${executable} stopte met code ${exitCode}: ${redactCommandError(stderr)}`
        ));
        return;
      }
      resolve({ stderr, stdout });
    });
  });
}

function parseFrameRate(value: unknown) {
  if (typeof value !== "string") return null;
  const [numerator, denominator = "1"] = value.split("/");
  const numeratorValue = Number(numerator);
  const denominatorValue = Number(denominator);
  if (!Number.isFinite(numeratorValue) || !Number.isFinite(denominatorValue) || denominatorValue <= 0) return null;
  const result = numeratorValue / denominatorValue;
  return result > 0 ? result : null;
}

function parseRotationDegrees(videoStream: Record<string, unknown>) {
  const sideData = Array.isArray(videoStream.side_data_list)
    ? videoStream.side_data_list.find(
        (entry) => isRecord(entry) && finiteNumber(entry.rotation) !== null
      )
    : null;
  const tags = isRecord(videoStream.tags) ? videoStream.tags : null;
  const rawRotation = isRecord(sideData)
    ? finiteNumber(sideData.rotation)
    : finiteNumber(tags?.rotate);
  if (rawRotation === null) return 0;
  const normalized = ((rawRotation % 360) + 360) % 360;
  return Math.abs(normalized - 360) < 0.01 || Math.abs(normalized) < 0.01
    ? 0
    : Math.round(normalized * 100) / 100;
}

function redactCommandError(stderr: string) {
  return stderr.trim().replace(/[\r\n]+/g, " ").slice(0, 500) || "geen foutdetails";
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function finiteNumber(value: unknown) {
  const result =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : NaN;
  return Number.isFinite(result) ? result : null;
}
function toFiniteNumber(value: unknown) {
  const result = finiteNumber(value);
  return result !== null && result > 0 ? result : null;
}
function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
function toPositiveInteger(value: unknown) {
  const result = toFiniteNumber(value);
  return result && Number.isInteger(result) ? result : null;
}
