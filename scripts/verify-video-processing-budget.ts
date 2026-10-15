/** Actual FFmpeg regression; synthetic input only, never production downloads.
 * MEDIA_TEST_CONTAINER optionally supplies FFmpeg with /tmp mounted at /evidence.
 * pnpm exec tsx scripts/verify-video-processing-budget.ts /tmp/veyocast-video-budget
 */
import { createHash } from "node:crypto";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createPlayerVideoPoster, normalizePlayerVideo, normalizationTimeoutMs,
  runCommand, type CommandRunner } from "../apps/media-worker/src/video-normalization";

async function main() {
  const directory = resolve(process.argv[2] ?? "/tmp/veyocast-video-budget");
  await mkdir(directory, {recursive: true});
  const inputPath = join(directory, "synthetic-portrait.mp4");
  const outputPath = join(directory, "player.mp4");
  const posterPath = join(directory, "poster.png");
  const container = process.env.MEDIA_TEST_CONTAINER;
  const runner: CommandRunner = (program, args, options) => {
    // A real-time reader makes exceeding the old 40 s deterministic on fast CI CPUs.
    const inputIndex = args.indexOf("-i");
    const boundedArgs = program === "ffmpeg" && args.includes(outputPath)
      ? [...args.slice(0, inputIndex), "-re", ...args.slice(inputIndex)] : args;
    return container
      ? runCommand("docker", ["exec", container, program, ...boundedArgs.map(arg =>
        arg.startsWith("/tmp/") ? arg.replace("/tmp/", "/evidence/") : arg)], options)
      : runCommand(program, boundedArgs, options);
  };
  await runner("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i",
    "testsrc2=size=1080x1920:rate=30", "-t", "46", "-c:v", "libx264", "-threads", "2",
    "-profile:v", "main", "-level:v", "5.1", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
    "-crf", "21", "-an", "-movflags", "+faststart", inputPath], {timeoutMs: 180_000});
  const started = performance.now();
  const result = await normalizePlayerVideo({inputPath, outputPath, runner});
  const elapsedMs = Math.round(performance.now() - started);
  await createPlayerVideoPoster({inputPath: outputPath, outputPath: posterPath, runner});
  if (elapsedMs <= 40_000 || result.output.width !== 1080 || result.output.height !== 1920
    || Math.abs(result.output.durationSeconds - 46) > 0.1 || (await stat(posterPath)).size <= 0) {
    throw new Error("Long-running video did not satisfy the verified portrait contract");
  }
  const evidence = {kind: "synthetic 46-second portrait; actual FFmpeg with real-time input",
    elapsedMs, budgetMs: normalizationTimeoutMs(result.input), input: result.input, output: result.output,
    playerBytes: (await stat(outputPath)).size,
    playerSha256: createHash("sha256").update(await readFile(outputPath)).digest("hex"),
    posterBytes: (await stat(posterPath)).size};
  await writeFile(join(directory, "result.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
