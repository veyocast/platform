/** Reproducible local quality/byte probe. No production downloads.
 * pnpm exec tsx scripts/verify-media-preset.ts /tmp/veyocast-video-proof
 * Requires ffmpeg/ffprobe; optional MEDIA_TEST_CONTAINER mounts host /tmp at /evidence.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { normalizePlayerVideo, runCommand, type CommandRunner } from "../apps/media-worker/src/video-normalization";

async function main() {
  const directory = resolve(process.argv[2] ?? "/tmp/veyocast-video-proof");
  await mkdir(directory, { recursive: true });
  const container = process.env.MEDIA_TEST_CONTAINER;
  const runner: CommandRunner = (program, args, options) => container
    ? runCommand("docker", ["exec", container, program, ...args.map((arg) => arg.startsWith("/tmp/") ? arg.replace("/tmp/", "/evidence/") : arg)], options)
    : runCommand(program, args, options);
  const original = join(directory, "synthetic-original.mp4");
  const normalized = join(directory, "player-v2.mp4");
  await runner("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30",
    "-t", "6", "-vf", "drawtext=text='VeyoCast test 1234567890':fontsize=24:fontcolor=white:box=1:boxcolor=black:x=20:y=40",
    "-c:v", "libx264", "-profile:v", "main", "-level:v", "4.0", "-pix_fmt", "yuv420p",
    "-b:v", "40M", "-minrate", "40M", "-maxrate", "40M", "-bufsize", "40M", "-x264-params", "nal-hrd=cbr:filler=1",
    "-an", "-movflags", "+faststart", original], { timeoutMs: 180_000 });
  const result = await normalizePlayerVideo({ inputPath: original, outputPath: normalized, runner });
  const comparison = await runner("ffmpeg", ["-hide_banner", "-i", original, "-i", normalized,
    "-lavfi", "[0:v][1:v]ssim", "-f", "null", "-"], { timeoutMs: 120_000 });
  await runner("ffmpeg", ["-hide_banner", "-y", "-ss", "3", "-i", original, "-ss", "3", "-i", normalized,
    "-filter_complex", "[0:v][1:v]hstack", "-frames:v", "1", join(directory, "comparison.png")]);
  const evidence = { kind: "synthetic-motion-and-text; not production creative or LG hardware", input: result.input,
    output: result.output, beforeBytes: (await stat(original)).size, afterBytes: (await stat(normalized)).size,
    ssim: comparison.stderr.split("\n").find((line) => line.includes("SSIM Y:")) };
  if (result.output.width !== 720 || result.output.height !== 1280 || evidence.afterBytes >= evidence.beforeBytes) {
    throw new Error("Preset failed dimension or byte regression check");
  }
  await writeFile(join(directory, "result.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
