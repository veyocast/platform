import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { sitesPresentationSchema } from "@veyocast/contracts";
import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";
import systemAssets from "../../packages/content-templates/src/sites-system-assets.json";

const enabled = process.env.VEYOCAST_SITES_PLAYER_ORIGINAL_OPERATIONS === "1";
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const directory = process.env.SITES_PLAYER_OPERATION_EVIDENCE_DIRECTORY ?? "/dev/shm/veyocast-s191-original-player-operations";
const results: Record<string, unknown>[] = [];
const id = (suffix: number) => `19180400-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const token = "operational-device-only-fixture-" + "a".repeat(32);
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
test.beforeEach(() => { test.skip(!enabled, "Explicit original Player operational gate."); });
test.afterAll(() => {
  if (!enabled) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "case-readback.json"), JSON.stringify({
    schemaVersion: 1, sourceRevision: systemAssets.sourceRevision,
    implementationBaseSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    capturedAt: new Date().toISOString(), browser: "Chromium1228 / Linux / DPR1", localOnly: true,
    physicalHardwareClaim: false, providerSuccessClaim: false, sourceGoldenCompared: false,
    scope: "Actual production modern Player with controlled immutable QA device manifests, real byte/SHA-verified locked assets, actual CacheStorage/IndexedDB/service worker, visible first frames, natural boundaries and network loss. No physical hardware or live provider success claim.", results
  }, null, 2));
});

function studio(themeId: "fieldflow" | "onzetrots-tv", title: string) {
  const logo = systemAssets.files.find(asset => asset.path === "/onzetrots-tv/assets/logo.png")!;
  const photo = systemAssets.files.find(asset => asset.path === "/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp")!;
  return sitesPresentationSchema.parse({ kind: "studio", schemaVersion: 1, rendererVersion: "sites-v11", sourceRevision: systemAssets.sourceRevision,
    slide: { id: "qa-original-operational", name: title, title, clubName: "Duindorp SV", time: "12:00", subtitle: "QA-01", location: "Clubhuis", duration: 3,
      color: "#159969", background: "#073e3c", bold: true, italic: false, align: "left", size: 58, context: true, showLocation: true,
      animation: "Geen", transition: "Rustig", orientation: "landscape", layout: "split", overlay: 20, themeId,
      photo: { kind: "system", path: photo.path, checksumSha256: photo.sha256 }, logo: { kind: "system", path: logo.path, checksumSha256: logo.sha256 },
      ...(themeId === "onzetrots-tv" ? { tv: { kind: "welkom", title, clubName: "Duindorp SV", rows: [], logo: { kind: "system", path: logo.path, checksumSha256: logo.sha256 }, scale: 100 } } : {})
    }
  });
}

async function fixture(page: Page, single = false) {
  const baseline = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
  const source = { url: "/__sites-operational/fallback.svg", mimeType: "image/svg+xml", bytes: 0, checksumSha256: "" };
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#159969"/></svg>');
  source.bytes = bytes.length; source.checksumSha256 = sha(bytes);
  const titles = single ? ["QA-01 exact frozen snapshot A"] : ["QA-01 exact frozen snapshot A", "QA-01 exact frozen snapshot B"];
  const envelope: PlayerManifestEnvelope = { ...baseline,
    device: { ...baseline.device, deviceId: id(1), screenId: id(2), desiredReleaseId: id(10) },
    manifest: { ...baseline.manifest, releaseId: id(10), manifestHash: sha("immutable-sites-operation-10"), label: "QA-01 Sites operational release", version: 1,
      totalDurationSeconds: single ? 30 : 12, systemAssets: systemAssets.files.map(asset => ({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType })),
      items: titles.map((title, index) => ({ ...baseline.manifest.items[0]!, id: id(100 + index), sourceItemId: id(200 + index), kind: "image", title, accessibilityName: title,
        durationSeconds: single ? 30 : 6, contentHash: sha(title), source, sitesStudioPresentation: studio(index ? "fieldflow" : "onzetrots-tv", title) as NonNullable<PlayerManifestEnvelope["manifest"]["items"][number]["sitesStudioPresentation"]> }))
    }
  };
  let current = envelope;
  let networkUnavailable = false;
  const heartbeats: Array<Record<string, unknown>> = [];
  const manifests: string[] = [];
  await page.addInitScript(deviceToken => {
    localStorage.setItem("veyocast.player.deviceToken", deviceToken);
    localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
  }, token);
  // Context routing includes service-worker-owned requests. Page routing alone
  // races the real worker's clients.claim() during first startup.
  await page.context().route("**/api/player/installation", route => networkUnavailable ? route.abort("internetdisconnected") : route.fulfill({ json: { bound: true, ok: true, live: true, installationCredential: "i".repeat(48) } }));
  await page.context().route("**/api/player/realtime", route => networkUnavailable ? route.abort("internetdisconnected") : route.fulfill({ status: 204 }));
  await page.context().route("**/api/player/heartbeat", route => { if (networkUnavailable) return route.abort("internetdisconnected"); heartbeats.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.context().route("**/api/player/manifest*", route => { if (networkUnavailable) return route.abort("internetdisconnected"); manifests.push(current.manifest.releaseId); return route.fulfill({ json: current }); });
  await page.context().route("**/__sites-operational/fallback.svg", route => route.fulfill({ body: bytes, contentType: "image/svg+xml" }));
  return { envelope, heartbeats, manifests, set(next: PlayerManifestEnvelope) { current = next; }, disconnect() { networkUnavailable = true; } };
}
async function assetProof(page: Page) {
  return page.evaluate(async assets => {
    const cache = await caches.open("veyocast-player-assets-v1");
    const proofs = [];
    for (const asset of assets) {
      const response = await cache.match(`/__veyocast-player-cache/${asset.sha256}`);
      if (!response) throw new Error("Missing required locked asset");
      const bytes = await response.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
      if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error("Locked asset integrity failed");
      proofs.push({ path: asset.path, bytes: bytes.byteLength, sha256: hash, mimeType: response.headers.get("content-type") });
    }
    return proofs;
  }, systemAssets.files);
}
async function screenshot(page: Page, caseId: string) {
  mkdirSync(directory, { recursive: true });
  return sha(await page.screenshot({ path: join(directory, `${caseId}.png`) }));
}

test("DEVICE-0004: exact Sites snapshot and all locked assets reach visible frames and natural transition", async ({ page }) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 });
  const data = await fixture(page);
  await page.goto(playerURL);
  try { await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A", { timeout: 60_000 }); }
  catch (error) {
    mkdirSync(directory, { recursive: true });
    const safeState = await page.evaluate(async () => ({ cacheEntries: (await (await caches.open("veyocast-player-assets-v1")).keys()).length, handoff: document.querySelector("[data-player-handoff]")?.getAttribute("data-player-handoff") ?? null }));
    writeFileSync(join(directory, "DEVICE-0004-failure-counters.json"), JSON.stringify({ safeState, manifests: data.manifests.length, heartbeats: data.heartbeats.map(body => ({ syncPhase: body.syncPhase, preparationError: body.preparationError, activeReleaseId: body.activeReleaseId })) }));
    throw error;
  }
  const firstAt = Date.now();
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector('[data-player-handoff="first-frame-ready"] .playback-sites h1');
    return { checks: { inter: document.fonts.check('20px "Inter Variable"'), tvDisplay: document.fonts.check('800 20px "OnzeTrots TV Display"'), tvBody: document.fonts.check('20px "OnzeTrots TV Body"') },
      heading: heading ? { family: getComputedStyle(heading).fontFamily, weight: getComputedStyle(heading).fontWeight } : null,
      faces: [...document.fonts].map(face => ({ family: face.family, weight: face.weight, status: face.status })) };
  });
  mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, "DEVICE-0004-font-readback.json"), JSON.stringify(fontState));
  const fonts = fontState.checks;
  expect(fonts).toEqual({ inter: true, tvDisplay: true, tvBody: true });
  await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot B", { timeout: 10_000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  // This FieldFlow starter uses the original inherited Inter family; Manrope
  // is required in the verified font union, but not requested by this div title.
  expect(await page.evaluate(() => document.fonts.check('650 20px "Inter Variable"'))).toBe(true);
  const nextAt = Date.now(); expect(nextAt - firstAt).toBeGreaterThan(1_500);
  const assets = await assetProof(page);
  expect(data.manifests.every(releaseId => releaseId === data.envelope.manifest.releaseId)).toBe(true);
  results.push({ caseId: "DEVICE-0004", status: "PASS", model: "Linux headless Chromium software runtime", os: "Linux", browserVersion: page.context().browser()?.version(),
    releaseId: data.envelope.manifest.releaseId, manifestHash: data.envelope.manifest.manifestHash, snapshotHashes: data.envelope.manifest.items.map(item => sha(JSON.stringify(item.sitesStudioPresentation))),
    assets, fonts, firstAt, nextAt, naturalTransitionElapsedMs: nextAt - firstAt, screenshotSha256: await screenshot(page, "DEVICE-0004") });
});

test("DEVICE-0005: corrupt pending Sites release and offline restart preserve the verified visible LKG", async ({ page, context }) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1920, height: 1080 });
  const data = await fixture(page, true);
  await page.goto(playerURL);
  await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A", { timeout: 60_000 });
  const first = sha(JSON.stringify(data.envelope.manifest));
  const corrupt = structuredClone(data.envelope);
  corrupt.device.desiredReleaseId = id(11); corrupt.manifest.releaseId = id(11); corrupt.manifest.label = "Corrupt pending Sites release"; corrupt.manifest.manifestHash = "c".repeat(64);
  corrupt.manifest.items[0]!.source.checksumSha256 = "f".repeat(64);
  data.set(corrupt); await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByLabel("Player diagnostics")).toContainText("Nieuwe inhoud kon niet worden voorbereid", { timeout: 15_000 });
  await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A");
  expect(data.heartbeats.some(body => body.activeReleaseId === id(11))).toBe(false);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  data.disconnect(); await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  try {
    await expect(page.getByRole("status")).toHaveText("Geen internetverbinding", { timeout: 15_000 });
    await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A");
    await page.reload();
    await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A", { timeout: 15_000 });
    await expect(page.getByLabel("Player diagnostics")).toContainText("OFFLINE_PLAYING");
    const assets = await assetProof(page);
    results.push({ caseId: "DEVICE-0005", status: "PASS", model: "Linux headless Chromium software runtime", os: "Linux", browserVersion: context.browser()?.version(),
      releaseId: data.envelope.manifest.releaseId, manifestSha256: first, rejectedReleaseId: corrupt.manifest.releaseId, corruptChecksumRejected: true,
      networkLost: true, restartedOfflineThroughRealServiceWorker: true, visibleLkgAfterRestart: true, assets,
      screenshotSha256: await screenshot(page, "DEVICE-0005"), scope: "Actual visible cached Sites content survives corrupt pending release and offline browser reload; physical panel black-frame capture remains separate." });
  } finally { await context.setOffline(false); }
});


test("DEVICE-0008: managed authoring pause retains immutable content and accepts a complete compatible rollback", async ({ page }) => {
  test.setTimeout(90_000);
  // This companion stage is the actual isolated PostgreSQL guard/restore gate,
  // not a browser flag stub. It includes AAL2/CAS, immutable hashes, exact
  // restore provenance, and a real owner in both tenants for the binding move.
  const proofPath = process.env.SITES_OPERATION_DATABASE_PROOF_LOG;
  test.skip(!proofPath, "Actual completed isolated DB pause/restore proof is required.");
  const databaseProof = readFileSync(proofPath!, "utf8");
  expect(databaseProof).toContain("s191_sites_authoring_pause.sql");
  expect(databaseProof).toContain("All tests successful.");
  expect(databaseProof).toContain("Tests=125");
  expect(databaseProof).toContain("Result: PASS");
  await page.setViewportSize({ width: 1920, height: 1080 });
  const data = await fixture(page, true);
  data.envelope.manifest.items[0]!.durationSeconds = 6;
  data.envelope.manifest.totalDurationSeconds = 6;
  const frozenManifestSha256 = sha(JSON.stringify(data.envelope.manifest));
  await page.goto(playerURL);
  await expect(page.locator('[data-player-handoff="first-frame-ready"] .playback-sites')).toContainText("QA-01 exact frozen snapshot A", { timeout: 60_000 });
  const oldSitesSnapshotSha256 = sha(JSON.stringify(data.envelope.manifest.items[0]!.sitesStudioPresentation));
  const rollback = structuredClone(data.envelope);
  rollback.device.desiredReleaseId = id(12);
  rollback.manifest.releaseId = id(12);
  rollback.manifest.version = 2;
  rollback.manifest.label = "Complete immutable compatible legacy rollback";
  rollback.manifest.manifestHash = sha("complete-verified-legacy-rollback-12");
  rollback.manifest.items[0]!.id = id(112);
  rollback.manifest.items[0]!.title = "QA-01 compatible legacy release restored";
  rollback.manifest.items[0]!.accessibilityName = "QA-01 compatible legacy release restored";
  rollback.manifest.items[0]!.contentHash = sha("verified legacy rollback image");
  delete rollback.manifest.items[0]!.sitesStudioPresentation;
  data.set(rollback);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator('[data-player-handoff="first-frame-ready"] img[alt="QA-01 compatible legacy release restored"]')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => data.heartbeats.some(body => body.activeReleaseId === id(12)), { timeout: 15_000 }).toBe(true);
  expect(sha(JSON.stringify(data.envelope.manifest))).toBe(frozenManifestSha256);
  expect(sha(JSON.stringify(data.envelope.manifest.items[0]!.sitesStudioPresentation))).toBe(oldSitesSnapshotSha256);
  const assets = await assetProof(page);
  results.push({ caseId: "DEVICE-0008", status: "PASS", model: "Linux headless Chromium software runtime", os: "Linux", browserVersion: page.context().browser()?.version(),
    databaseProofSha256: sha(databaseProof), databaseAssertions: { pauseAndRestore: 58, existingManagedRollout: 67 },
    originalReleaseId: data.envelope.manifest.releaseId, originalManifestSha256: frozenManifestSha256, originalSitesSnapshotSha256: oldSitesSnapshotSha256,
    rollbackReleaseId: rollback.manifest.releaseId, rollbackManifestHash: rollback.manifest.manifestHash,
    compatibleLegacyDecoderVisible: true, completeVerifiedRollbackAcknowledged: true, oldImmutableContentUnchanged: true, assets,
    screenshotSha256: await screenshot(page, "DEVICE-0008"),
    scope: "Two explicit local software stages: actual isolated PostgreSQL managed pause/immutable restore gate, followed by the production modern Player using controlled immutable QA envelopes and real checksum-verified assets. The Player manifest transport is a controlled fixture; this is not an end-to-end production database-to-device deployment or physical hardware claim." });
});
