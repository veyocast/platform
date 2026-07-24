import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEmptyStudioDocument } from "@veyocast/studio";

import { ResvgSharpStudioRenderer } from "../src/studio-render-resvg";
import {
  encodeStudioMp4,
  probeAndValidateStudioMp4
} from "../src/studio-render-video";

const workingDirectory = await mkdtemp(
  join(tmpdir(), "veyocast-studio-codec-smoke-")
);
const outputPath = join(workingDirectory, "studio-codec-smoke.mp4");
const format =
  process.env.STUDIO_SMOKE_FORMAT === "portrait-hd"
    ? "portrait-hd"
    : "landscape-hd";
const requestedDurationSeconds = Number.parseInt(
  process.env.STUDIO_SMOKE_DURATION_SECONDS ?? "1",
  10
);
if (
  !Number.isSafeInteger(requestedDurationSeconds) ||
  requestedDurationSeconds < 1 ||
  requestedDurationSeconds > 30
) {
  throw new Error("STUDIO_SMOKE_DURATION_SECONDS must be an integer from 1 to 30");
}

try {
  const document = createEmptyStudioDocument(format, {
    background: "#171717",
    durationMs: requestedDurationSeconds * 1_000,
    motionEnabled: true
  });
  const renderer = new ResvgSharpStudioRenderer();
  const startedAt = performance.now();
  const encoded = await encodeStudioMp4({
    document,
    outputPath,
    renderer
  });
  const probe = await probeAndValidateStudioMp4({
    durationMs: document.motion.durationMs,
    expectedHeight: document.artboard.height,
    expectedWidth: document.artboard.width,
    inputPath: outputPath
  });
  const artifact = await stat(outputPath);

  process.stdout.write(`${JSON.stringify({
    bytes: artifact.size,
    codec: probe.videoCodec,
    durationSeconds: probe.durationSeconds,
    elapsedSeconds: Number(((performance.now() - startedAt) / 1_000).toFixed(3)),
    faststart: true,
    format,
    fps: probe.framesPerSecond,
    frameCount: encoded.frameCount,
    height: probe.height,
    pixelFormat: probe.pixelFormat,
    width: probe.width
  })}\n`);
} finally {
  await rm(workingDirectory, { force: true, recursive: true });
}
