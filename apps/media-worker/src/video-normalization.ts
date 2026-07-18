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
  durationSeconds: number;
  formatNames: string[];
  framesPerSecond: number;
  height: number;
  pixelFormat: string | null;
  videoCodec: string;
  width: number;
};

export type VideoNormalizationResult = {
  input: VideoProbe;
  output: VideoProbe;
  outputPath: string;
};

export class VideoProcessingError extends Error {
  constructor(
    readonly code:
      | "command_failed"
      | "invalid_probe"
      | "normalization_failed"
      | "unsupported_input",
    message: string
  ) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

const maximumCapturedOutputBytes = 5 * 1024 * 1024;
const defaultCommandTimeoutMs = 5 * 60 * 1_000;

export async function probeVideoFile(
  inputPath: string,
  runner: CommandRunner = runCommand
): Promise<VideoProbe> {
  const result = await runner("ffprobe", [
    "-v", "error", "-show_entries",
    "format=format_name,duration:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
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
    await runner("ffmpeg", buildNormalizationArguments(inputPath, outputPath), {
      timeoutMs: defaultCommandTimeoutMs
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

export function buildNormalizationArguments(inputPath: string, outputPath: string) {
  return [
    "-hide_banner", "-nostdin", "-y", "-i", inputPath,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
    "-c:v", "libx264", "-profile:v", "main", "-level:v", "4.0",
    "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "21",
    "-maxrate", "6M", "-bufsize", "12M",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", "-f", "mp4", outputPath
  ] as const;
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
  if (!durationSeconds || !width || !height || !videoCodec || !formatName || !framesPerSecond) {
    throw new VideoProcessingError("invalid_probe", "Videometadata is incompleet of ongeldig.");
  }

  return {
    audioCodec: isRecord(audioStream) ? toNonEmptyString(audioStream.codec_name) : null,
    durationSeconds,
    formatNames: formatName.split(",").map((name) => name.trim()),
    framesPerSecond,
    height,
    pixelFormat: toNonEmptyString(videoStream.pix_fmt),
    videoCodec,
    width
  };
}

export function validateInputProbe(probe: VideoProbe) {
  if (!probe.formatNames.some((name) => name === "mov" || name === "mp4")) {
    throw new VideoProcessingError("unsupported_input", "Alleen een MP4-container wordt verwerkt.");
  }
  if (probe.durationSeconds > maxVideoDurationSeconds) {
    throw new VideoProcessingError(
      "unsupported_input",
      `Video duurt langer dan ${maxVideoDurationSeconds} seconden.`
    );
  }
}

export function validatePlayerVariant(probe: VideoProbe) {
  const failures = [
    !probe.formatNames.some((name) => name === "mov" || name === "mp4") && "MP4-container ontbreekt",
    probe.videoCodec !== "h264" && "videocodec is niet H.264",
    probe.audioCodec !== null && probe.audioCodec !== "aac" && "audiocodec is niet AAC",
    (probe.width > 1920 || probe.height > 1080) && "resolutie is groter dan 1080p",
    probe.framesPerSecond > 30.01 && "framerate is hoger dan 30 fps",
    probe.pixelFormat !== "yuv420p" && "pixel format is niet yuv420p",
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
      finishReject(`Commando ${executable} overschreed de tijdslimiet.`);
    }, options.timeoutMs ?? defaultCommandTimeoutMs);

    function append(current: string, chunk: Buffer) {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next) > maximumCapturedOutputBytes) {
        child.kill("SIGKILL");
        finishReject(`Uitvoer van ${executable} overschreed de veiligheidslimiet.`);
      }
      return next;
    }
    function finishReject(message: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new VideoProcessingError("command_failed", message));
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

function redactCommandError(stderr: string) {
  return stderr.trim().replace(/[\r\n]+/g, " ").slice(0, 500) || "geen foutdetails";
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function toFiniteNumber(value: unknown) {
  const result = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(result) && result > 0 ? result : null;
}
function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
function toPositiveInteger(value: unknown) {
  const result = toFiniteNumber(value);
  return result && Number.isInteger(result) ? result : null;
}
