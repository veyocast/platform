import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { syncBackgroundScenes, syncSlidePresentationSchema, syncSystemAssets } from "@veyocast/contracts";
import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";
import type { SyncBackgroundBinaryRegistry } from "../helpers/sync-background-binary";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const id = (n: number) => `23800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Scene = typeof syncBackgroundScenes[number];
async function envelope(page: Page, scene: Scene, orientation: "landscape" | "portrait", connected: boolean, revision = 1) {
  const response = await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`);
  const result = await response.json() as PlayerManifestEnvelope, asset = scene[orientation];
  result.manifest.items = [result.manifest.items[0]!];
  const item = result.manifest.items[0]!;
  item.durationSeconds = 6; item.id = id(100 + revision);
  const presentation = syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-v1", sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", family: "fixtures", orientation, theme: "onzetrots-tv", name: scene.label, title: "Eigen programma", club: { name: "Eigen club" }, rows: Array.from({ length: 5 }, (_, i) => [`Thuis ${i}`, `Uit ${i}`, "14:00", "1"]), style: { background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } });
  const directory = process.env.S238_BACKGROUND_BINARIES;
  if (!directory) throw Error("Generate the complete local Source MP4 fixtures before starting the Player browser cohort");
  const registry = JSON.parse(readFileSync(join(directory, "registry.json"), "utf8")) as SyncBackgroundBinaryRegistry;
  const binary = registry[`${scene.id}-${orientation}`]!;
  expect(binary.presentationChecksumSha256).toBe(createHash("sha256").update(JSON.stringify(presentation)).digest("hex"));
  for (const [filename, mimeType, checksum] of [[binary.filename, binary.mimeType, binary.checksumSha256], [binary.posterFilename, "image/png", binary.posterChecksumSha256], [binary.secondPageFilename, "image/png", binary.secondPageChecksumSha256]] as const) {
    const bytes = readFileSync(join(directory, filename)); expect(createHash("sha256").update(bytes).digest("hex")).toBe(checksum);
    await page.route(`**/s238-background-binary/${filename}`, route => route.fulfill({ body: bytes, contentType: mimeType }));
  }
  item.kind = "video"; item.title = `${scene.label} ${orientation}`;
  item.source = { url: `${playerURL}/s238-background-binary/${binary.filename}`, mimeType: binary.mimeType, bytes: binary.bytes, checksumSha256: binary.checksumSha256, posterUrl: `${playerURL}/s238-background-binary/${binary.posterFilename}`, posterBytes: binary.posterBytes, posterChecksumSha256: binary.posterChecksumSha256 };
  if (connected) item.syncDynamic = { schemaVersion: 1, configurationSnapshotId: id(201), snapshotId: id(202), templateVersionId: id(203), configurationHash: "c".repeat(64), contentHash: "d".repeat(64), fallbackChecksumSha256: item.source.checksumSha256, durationMs: 6000, presentation, assets: {}, dataRevision: 1 };
  else { item.syncStudioPresentation = presentation; item.syncStudioDurationMs = 6000; item.syncStudioAssets = {}; }
  result.manifest.syncSystemAssets = [...syncSystemAssets, asset].map(ref => ({ path: ref.path, checksumSha256: ref.sha256, bytes: ref.bytes, mimeType: ref.mimeType }));
  result.manifest.releaseId = id(revision); result.device.desiredReleaseId = id(revision); result.manifest.manifestHash = createHash("sha256").update(JSON.stringify(presentation)).digest("hex");
  result.manifest.version = revision; result.manifest.label = `Galerij ${scene.label} ${orientation}`;
  result.manifest.totalBytes = item.source.bytes + binary.posterBytes + result.manifest.syncSystemAssets.reduce((sum, ref) => sum + ref.bytes, 0); result.manifest.totalDurationSeconds = 6;
  return result;
}
async function activeId(page: Page) {
  return page.evaluate(() => new Promise<string>((resolve, reject) => {
    const open = indexedDB.open("veyocast-player-cache-v1"); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const read = db.transaction("activeReleases").objectStore("activeReleases").get("demo-online"); read.onerror = () => reject(read.error); read.onsuccess = () => { db.close(); resolve(read.result?.envelope.manifest.releaseId ?? ""); }; };
  }));
}
for (const [index, scene] of syncBackgroundScenes.entries()) for (const orientation of ["landscape", "portrait"] as const) test(`${scene.label} ${orientation}: verified local scene survives pages and cold offline startup`, async ({ page, context }, info) => {
  const value = await envelope(page, scene, orientation, index % 2 === 1), asset = scene[orientation], headers: string[] = [];
  await page.route("**/api/player/manifest", route => { headers.push(route.request().headers()["x-veyocast-sync-backgrounds"] ?? ""); return route.fulfill({ json: value }); });
  await page.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
  await expect(page.locator(".vc-slide-preview").first()).toContainText("Thuis 0");
  await expect(page.locator(".vc-slide-preview").first()).toContainText("Thuis 4");
  expect(headers).toContain("sync-backgrounds-v1"); expect(await activeId(page)).toBe(value.manifest.releaseId);
  const checksum = await page.evaluate(async hash => { const cache = await caches.open("veyocast-player-assets-v1"), response = await cache.match(`/__veyocast-player-cache/${hash}`); if (!response) throw Error("Missing gallery cache"); const bytes = await response.arrayBuffer(); return { bytes: bytes.byteLength, mimeType: response.headers.get("content-type"), hash: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("") }; }, asset.sha256);
  expect(checksum).toEqual({ bytes: asset.bytes, mimeType: asset.mimeType, hash: asset.sha256 });
  await info.attach("verified-gallery-frame", { body: await page.screenshot(), contentType: "image/png" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true); await page.close();
  const cold = await context.newPage(); await cold.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);
  await expect(cold.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
  await expect(cold.locator(".vc-slide-preview").first()).toBeVisible(); expect(await activeId(cold)).toBe(value.manifest.releaseId);
  await expect(cold.locator(".vc-slide-preview").first()).toContainText("Thuis 0");
  await expect(cold.locator(".vc-slide-preview").first()).toContainText("Thuis 4");
  const local = await cold.locator(".vc-slide-preview").first().evaluate(element => getComputedStyle(element).backgroundImage);
  expect(local).toMatch(/blob:|__veyocast-player-cache/); expect(local).not.toContain(asset.path);
});

test("a corrupt pending photograph cannot replace the active gallery release", async ({ page }) => {
  const active = await envelope(page, syncBackgroundScenes[0], "landscape", false), pending = await envelope(page, syncBackgroundScenes[1], "portrait", true, 2);
  let current = active; let corruptRequests = 0;
  await page.route("**/api/player/manifest", route => route.fulfill({ json: current }));
  await page.route(`**${syncBackgroundScenes[1].portrait.path}`, route => {
    corruptRequests++; const bytes = Buffer.from(readFileSync(join(process.cwd(), "apps/player/public", syncBackgroundScenes[1].portrait.path))); bytes[20] = bytes[20]! ^ 1;
    return route.fulfill({ body: bytes, contentType: "image/webp" });
  });
  await page.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached(); current = pending;
  await expect.poll(() => corruptRequests, { timeout: 11000 }).toBeGreaterThan(0);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Nieuwe inhoud kon niet worden voorbereid; huidige inhoud blijft spelen.");
  expect(await activeId(page)).toBe(active.manifest.releaseId);
  const cached = await page.evaluate(async hash => {
    const response = await (await caches.open("veyocast-player-assets-v1")).match(`/__veyocast-player-cache/${hash}`);
    if (!response) throw Error("Active complete fallback missing");
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()))].map(value => value.toString(16).padStart(2, "0")).join("");
  }, active.manifest.items[0]!.source.checksumSha256);
  expect(cached).toBe(active.manifest.items[0]!.source.checksumSha256);
  await expect(page.locator(".vc-slide-preview").first()).toBeVisible();
  await expect(page.locator(".vc-slide-preview").first()).toContainText("Thuis 4");
});

test("the complete candidate waits for actual image decode before activation", async ({ page }) => {
  const active = await envelope(page, syncBackgroundScenes[0], "landscape", false), pending = await envelope(page, syncBackgroundScenes[2], "portrait", false, 2);
  let current = active;
  await page.route("**/api/player/manifest", route => route.fulfill({ json: current }));
  await page.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`); await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
  await page.evaluate(() => {
    const decode = Image.prototype.decode;
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    Reflect.set(globalThis, "releaseGalleryDecode", release);
    Image.prototype.decode = async function () { await decode.call(this); if (this.naturalWidth === 941 && this.naturalHeight === 1672) { Reflect.set(globalThis, "galleryDecodeWaiting", true); await gate; } };
  });
  current = pending; await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "galleryDecodeWaiting")), { timeout: 11000 }).toBe(true);
  expect(await activeId(page)).toBe(active.manifest.releaseId); await expect(page.locator(".vc-slide-preview").first()).toBeVisible();
  await expect(page.locator('.vc-slide-preview[aria-label="Voorbeeld: Houtrust"]').first()).toContainText("Thuis 4");
  expect(await activeId(page)).toBe(active.manifest.releaseId);
  await expect(page.locator('.vc-slide-preview[aria-label="Voorbeeld: Houtrust"]').first()).toBeVisible();
  await page.evaluate(() => Reflect.get(globalThis, "releaseGalleryDecode")());
  await expect.poll(() => activeId(page)).toBe(pending.manifest.releaseId);
  await expect(page.locator(".vc-slide-preview").first()).toBeVisible();
});

test("a DOM-capable browser without image.decode omits only the new gallery capability and plays the complete binary", async ({ page }, info) => {
  await page.addInitScript(() => { Object.defineProperty(Image.prototype, "decode", { configurable: true, value: undefined }); });
  const binary = await envelope(page, syncBackgroundScenes[0], "landscape", false);
  delete binary.manifest.items[0]!.syncStudioPresentation; delete binary.manifest.items[0]!.syncStudioDurationMs; delete binary.manifest.items[0]!.syncStudioAssets;
  delete binary.manifest.syncSystemAssets;
  binary.manifest.totalBytes = binary.manifest.items[0]!.source.bytes + binary.manifest.items[0]!.source.posterBytes!;
  const requests: Record<string, string>[] = [];
  await page.route("**/api/player/manifest", route => { requests.push(route.request().headers()); return route.fulfill({ json: binary }); });
  await page.goto(`${playerURL}/?deviceToken=demo-online&syncMs=250`);
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0]!["x-veyocast-sync-renderer"]).toBe("sync-v1");
  expect(requests[0]!["x-veyocast-sync-dynamic"]).toBe("sync-dynamic-v1");
  expect(requests[0]).not.toHaveProperty("x-veyocast-sync-backgrounds");
  const video = page.locator("video").first(); await expect(video).toBeVisible();
  const frames = await video.evaluate(async (element: HTMLVideoElement, posterUrl: string) => {
    element.pause();
    const canvas = document.createElement("canvas"); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
    const context = canvas.getContext("2d")!;
    const frame = async (time: number, referenceUrl: string) => {
      await new Promise<void>(resolve => { element.addEventListener("seeked", () => resolve(), { once: true }); element.currentTime = time; });
      context.drawImage(element, 0, 0); const png = canvas.toDataURL(), pixels = [...context.getImageData(1780, 10, 40, 40).data];
      const reference = new Image(); await new Promise<void>((resolve, reject) => { reference.onload = () => resolve(); reference.onerror = () => reject(Error("Complete Source reference unavailable")); reference.src = referenceUrl; });
      context.drawImage(reference, 0, 0); const referencePixels = context.getImageData(1780, 10, 40, 40).data;
      return { png, pixels, sourceDifference: pixels.reduce((sum, value, index) => sum + Math.abs(value - referencePixels[index]!), 0) / pixels.length };
    };
    return { width: element.videoWidth, height: element.videoHeight, duration: element.duration, first: await frame(0.4, posterUrl), second: await frame(5.5, posterUrl.replace("-page1.png", "-page2.png")), source: element.currentSrc };
  }, binary.manifest.items[0]!.source.posterUrl!);
  expect(frames).toMatchObject({ width: 1920, height: 1080, duration: 6 }); expect(frames.source).toMatch(/blob:|__veyocast-player-cache/);
  expect(frames.first.png).not.toBe(frames.second.png);
  expect(frames.first.sourceDifference).toBeLessThan(5); expect(frames.second.sourceDifference).toBeLessThan(5);
  const difference = frames.first.pixels.reduce((sum, value, index) => sum + Math.abs(value - frames.second.pixels[index]!), 0) / frames.first.pixels.length;
  expect(difference).toBeLessThan(5);
  for (const [name, frame] of [["complete-binary-page1", frames.first], ["complete-binary-page2", frames.second]] as const) await info.attach(name, { body: Buffer.from(frame.png.split(",")[1]!, "base64"), contentType: "image/png" });
});
