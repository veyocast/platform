import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd(), require = createRequire(join(root, "apps/media-worker/package.json"));
const load = path => import(pathToFileURL(join(root, path)).href);
const contracts = await import(pathToFileURL(require.resolve("@veyocast/contracts")).href);
const sharp = require("sharp");
await load("apps/media-worker/src/index.ts");
for (const name of ["next", "expo", "react-native", "vitest", "@playwright/test", "@webos-tools/cli"]) {
  assert.throws(() => require.resolve(name), { code: "MODULE_NOT_FOUND" });
}
const manifest = JSON.parse(readFileSync(join(root, "WORKER_RUNTIME_MANIFEST.json"), "utf8"));
assert.ok(manifest.packages.some(entry => entry.name === "tsx"));
assert.ok(manifest.packages.every(entry => !["next", "expo", "react-native", "vitest"].includes(entry.name)));
const assets = new Map();
for (const name of ["syncSystemAssets", "syncBackgroundAssets", "syncOnzeTrotsSystemAssets", "syncOnzeTrotsV9SystemAssets"]) {
  assert.ok(Array.isArray(contracts[name]), name);
  for (const asset of contracts[name]) assets.set(asset.path, asset);
}
for (const asset of JSON.parse(readFileSync(join(root, "packages/content-templates/src/sites-system-assets.json"), "utf8")).files) assets.set(asset.path, asset);
for (const asset of assets.values()) {
  const bytes = readFileSync(join(root, "apps/player/public", asset.path));
  assert.equal(bytes.length, asset.bytes, asset.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
}
const { getSitesBrowserRenderBundle } = await load("apps/media-worker/src/sites-dom-browser-bundle.ts");
const bundle = await getSitesBrowserRenderBundle();
assert.ok(bundle.length > 1000 && Buffer.byteLength(bundle) < 2 * 1024 * 1024);
const { ResvgSharpStudioRenderer, validateStudioRendererFonts } = await load("apps/media-worker/src/studio-render-resvg.ts");
validateStudioRendererFonts();
const svg = await new ResvgSharpStudioRenderer().renderPng({ width: 320, height: 180,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="white"/><text x="20" y="90" font-family="Inter" font-size="24">Runtimecontrole € 12,50</text></svg>' });
assert.equal((await sharp(svg).metadata()).width, 320);
const directory = process.env.WORKER_SMOKE_OUTPUT ?? "/tmp/veyocast-worker-smoke";
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "studio-svg.png"), svg);
const ffmpeg = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x64:r=1", "-t", "1",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", join(directory, "video.mp4")], { encoding: "utf8", timeout: 30000 });
assert.equal(ffmpeg.status, 0, ffmpeg.error?.message ?? ffmpeg.stderr);
const probe = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", join(directory, "video.mp4")], { encoding: "utf8", timeout: 10000 });
assert.equal(probe.status, 0, probe.error?.message ?? probe.stderr);
assert.equal(JSON.parse(probe.stdout).streams[0].codec_name, "h264");
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";
const { createSyncSlideCapture } = await load("apps/media-worker/src/sync-dom-capture.tsx");
for (const layout of ["beeldheld", "nachteditie", "clubkrant"]) for (const orientation of ["landscape", "portrait"]) {
  const news = [{ id: "runtime-check", title: "Controle van de volledige Worker-runtime", intro: "Fonts, artikeltekst en de echte artikelbestemming blijven samen behouden.", source: "Voorbeeldbron", url: "https://example.org/worker-runtime-check" }];
  const presentation = contracts.syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-onzetrots-v9",
    sourceRevision: "5ba52a657d6d16ad103ba2fb43b8db18aa83715a", family: "rss", orientation, theme: "onzetrots-tv",
    name: "Runtimecontrole", club: { name: "Testomgeving" }, title: "Nieuws", rows: [], style: {},
    news: news.map(({ title, intro, source, url }) => ({ title, intro, source, url })),
    rich: { news }, visual: { schemaVersion: 1, mode: "light", scrollSpeed: "normal", panelOpacity: 94 },
    authoring: { schemaVersion: 1, visualRevision: "onzetrots-20261024", rssLayout: layout, headerSubtitles: {}, headerTexts: {}, welcomeScalePercent: 150 } });
  const capture = await createSyncSlideCapture({ presentation, durationMs: 12000, executablePath });
  try {
    const png = await capture.renderPng(4000), metadata = await sharp(png).metadata();
    assert.equal(metadata.width, orientation === "landscape" ? 1920 : 1080);
    assert.equal(metadata.height, orientation === "landscape" ? 1080 : 1920);
    assert.ok((await sharp(png).stats()).channels.some(channel => channel.stdev > 5));
    writeFileSync(join(directory, `${layout}-${orientation}.png`), png);
  } finally { await capture.close(); }
}
const { createSitesPresentationCapture } = await load("apps/media-worker/src/sites-dom-capture.tsx");
const menu = contracts.sitesPresentationSchema.parse({ kind: "dynamic", configuration: { schemaVersion: 1, rendererVersion: "sites-v17",
  sourceRevision: contracts.sitesCurrentPresentationSourceRevision, provider: "menu", unifiedKind: "kantine", themeId: "onzetrots-tv",
  orientation: "landscape", title: "Runtimecontrole", accent: "#c12545", menuWidgets: true, seconds: 15 },
  content: { kind: "kantine", title: "Runtimecontrole", rows: [], menuPages: [{ id: "one-page", columns: 2,
    widgets: [{ id: "products", type: "category", column: "full", columns: 2, title: "Producten", rows: Array.from({ length: 16 }, (_, index) =>
      ({ id: `product-${index}`, column: index < 8 ? 1 : 2, primary: `Product ${index + 1}`, value: "€ 12,50" })) }] }] } });
const capture = await createSitesPresentationCapture({ presentation: menu, executablePath });
try {
  const png = await capture.renderPng(1200);
  assert.equal((await sharp(png).metadata()).width, 1920);
  writeFileSync(join(directory, "menu-16-products.png"), png);
} finally { await capture.close(); }
process.stdout.write(`${JSON.stringify({ event: "worker_runtime_smoke_pass", packages: manifest.packages.length, bytes: manifest.bytes,
  verifiedAssets: assets.size, nativeRssCaptures: 6, menuProducts: 16, svg: true, h264: true, browserBundle: Buffer.byteLength(bundle) })}\n`);
