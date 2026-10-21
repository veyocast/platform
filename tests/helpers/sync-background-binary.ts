import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { syncBackgroundScenes, syncSlidePresentationSchema } from "../../packages/contracts/src/index";
import { createSyncStudioDocument } from "../../packages/studio/src/sync";
import { createSyncSlideCapture } from "../../apps/media-worker/src/sync-dom-capture";
import { encodeStudioMp4, probeAndValidateStudioMp4 } from "../../apps/media-worker/src/studio-render-video";

export function backgroundBinaryPresentation(scene: typeof syncBackgroundScenes[number], orientation: "landscape" | "portrait") {
  const asset = scene[orientation];
  return syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-v1", sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", family: "fixtures", orientation, theme: "onzetrots-tv", name: scene.label, title: "Eigen programma", club: { name: "Eigen club" }, rows: Array.from({ length: 5 }, (_, i) => [`Thuis ${i}`, `Uit ${i}`, "14:00", "1"]), style: { background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } });
}
export type SyncBackgroundBinary = {
  filename: string; posterFilename: string; secondPageFilename: string;
  bytes: number; checksumSha256: string; mimeType: "video/mp4"; width: number; height: number; durationMs: number;
  posterBytes: number; posterChecksumSha256: string; secondPageChecksumSha256: string;
  presentationChecksumSha256: string;
};
export type SyncBackgroundBinaryRegistry = Record<string, SyncBackgroundBinary>;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Local-only fixture production uses the same complete Source capture and
 * encoder/probe as publication. Every browser is closed before Player starts. */
export async function createSyncBackgroundBinaries(outputDirectory: string, executablePath: string) {
  await mkdir(outputDirectory, { recursive: false });
  const registry: SyncBackgroundBinaryRegistry = {};
  for (const scene of syncBackgroundScenes) for (const orientation of ["landscape", "portrait"] as const) {
    const presentation = backgroundBinaryPresentation(scene, orientation), document = createSyncStudioDocument(presentation, 3);
    const capture = await createSyncSlideCapture({ presentation, durationMs: document.motion.durationMs, executablePath });
    const key = `${scene.id}-${orientation}`, filename = `${key}.mp4`, posterFilename = `${key}-page1.png`, secondPageFilename = `${key}-page2.png`;
    try {
      const poster = await capture.renderPng(400), second = await capture.renderPng(5999);
      if (poster.equals(second)) throw Error("The complete fixture must contain both Source pages");
      const { width, height } = document.artboard;
      for (const png of [poster, second]) if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw Error("Unexpected Source PNG dimensions");
      await writeFile(join(outputDirectory, posterFilename), poster, { flag: "wx" });
      await writeFile(join(outputDirectory, secondPageFilename), second, { flag: "wx" });
      await encodeStudioMp4({ document, outputPath: join(outputDirectory, filename), renderFrame: time => capture.renderRgba(time), renderer: {
        renderPng: async () => { throw Error("Source capture required"); }, renderRgba: async () => { throw Error("Source capture required"); },
      } });
      await probeAndValidateStudioMp4({ inputPath: join(outputDirectory, filename), durationMs: document.motion.durationMs, expectedWidth: width, expectedHeight: height });
      const bytes = await readFile(join(outputDirectory, filename));
      registry[key] = { filename, posterFilename, secondPageFilename, bytes: bytes.byteLength, checksumSha256: hash(bytes), mimeType: "video/mp4", width, height, durationMs: document.motion.durationMs, posterBytes: poster.byteLength, posterChecksumSha256: hash(poster), secondPageChecksumSha256: hash(second), presentationChecksumSha256: hash(Buffer.from(JSON.stringify(presentation))) };
    } finally { await capture.close(); }
  }
  await writeFile(join(outputDirectory, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, { flag: "wx" });
  return registry;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("tests/helpers/sync-background-binary.ts")) {
  const directory = process.env.S238_BACKGROUND_BINARIES, chromium = process.env.SITES_CAPTURE_TEST_CHROMIUM;
  if (!directory || !chromium) throw Error("Explicit local fixture directory and pinned Chromium executable required");
  void createSyncBackgroundBinaries(directory, chromium).then(() => {
    process.stdout.write(`Six complete Source MP4 fixtures and twelve PNG pages verified; all capture browsers closed: ${directory}\n`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
