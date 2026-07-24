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

try {
  const document = createEmptyStudioDocument("landscape-hd", {
    background: "#171717",
    durationMs: 1_000,
    motionEnabled: true
  });
  const renderer = new ResvgSharpStudioRenderer();
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
    faststart: true,
    fps: probe.framesPerSecond,
    frameCount: encoded.frameCount,
    height: probe.height,
    pixelFormat: probe.pixelFormat,
    width: probe.width
  })}\n`);
} finally {
  await rm(workingDirectory, { force: true, recursive: true });
}
