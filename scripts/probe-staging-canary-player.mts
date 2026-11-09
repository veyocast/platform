import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { chromium } from "@playwright/test";

// Actual hosted Player, without request interception or provider requests.
// Device credentials stay in a private file/browser context; no HAR or trace.
const origin = "https://staging-player.veyocast.nl";
const tokenFile = process.env.CANARY_DEVICE_TOKEN_FILE;
assert(tokenFile, "CANARY_DEVICE_TOKEN_FILE must name a private canary credential file");
const token = readFileSync(tokenFile, "utf8").trim();
assert(/^[A-Za-z0-9_-]{32,256}$/.test(token), "invalid credential file");
const output = resolve(process.env.CANARY_EVIDENCE_DIRECTORY ?? ".tmp/staging-canary-player");
const orientation = process.env.CANARY_ORIENTATION ?? "landscape";
assert(orientation === "landscape" || orientation === "portrait", "invalid canary orientation");
const evidenceMode = process.env.CANARY_EVIDENCE_MODE ?? "interactive";
assert(evidenceMode === "interactive" || evidenceMode === "rank-tail", "invalid evidence mode");
mkdirSync(output, { recursive: true, mode: 0o700 });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
const page = await context.newPage();
const requests: Array<Record<string, unknown>> = [];
const frames: Array<Record<string, unknown>> = [];
const snapshots: Array<Record<string, unknown>> = [];
const errors: string[] = [];
page.on("pageerror", () => errors.push("PLAYER_PAGE_ERROR"));
page.on("response", async response => {
  if (new URL(response.url()).pathname !== "/api/player/manifest") return;
  const row: Record<string, unknown> = { at: new Date().toISOString(), status: response.status(), conditional: Boolean(response.request().headers()["if-none-match"]), etag: response.headers().etag ?? null };
  if (response.status() === 200) {
    const body = await response.json().catch(() => null);
    row.releaseId = body?.manifest?.releaseId ?? null;
    row.items = body?.manifest?.items?.map((item: { id: string; syncDynamic?: { dataRevision: number; contentHash: string; configurationSnapshotId: string } }) => ({ id: item.id, revision: item.syncDynamic?.dataRevision ?? null, contentHash: item.syncDynamic?.contentHash ?? null, snapshotId: item.syncDynamic?.configurationSnapshotId ?? null }));
  }
  requests.push(row);
});
page.on("request", request => {
  if (new URL(request.url()).pathname !== "/api/player/heartbeat") return;
  const data = request.postDataJSON()?.sourceDataConfirmation;
  if (data) frames.push({ at: new Date().toISOString(), revision: data.dataRevision, contentHash: data.contentHash, snapshotId: data.configurationSnapshotId, itemId: data.itemId, rendererVersion: data.rendererVersion });
});
await page.addInitScript(credential => { localStorage.setItem("veyocast.player.deviceToken", credential); }, token);

async function snapshot(label: string) {
  assert(/^[a-z0-9-]{1,64}$/.test(label), "invalid evidence label");
  await page.waitForFunction(() => {
    const roots = [...document.querySelectorAll('[data-player-handoff="first-frame-ready"] [data-sync-ready="true"]')];
    const root = roots.at(-1);
    if (!root) return false;
    return [...root.querySelectorAll(".slide-content .panel")].every(panel => {
      const style = getComputedStyle(panel);
      return Number(style.opacity) >= 0.99 && (style.filter === "none" || style.filter === "blur(0px)");
    });
  }, undefined, { timeout: 10_000 });
  const visible = await page.evaluate(() => ({
    ready: document.querySelector('[data-player-handoff="first-frame-ready"] [data-sync-ready="true"]') !== null,
    contentHashes: [...document.querySelectorAll<HTMLElement>('[data-sync-ready="true"]')].map(node => node.dataset.syncContentHash),
    visibleText: [...document.querySelectorAll('[data-sync-ready="true"] .vc-slide-preview')].at(-1)?.textContent?.replace(/\s+/g, " ").trim().slice(0, 2000) ?? null,
    results: document.querySelector(".dashboard-results")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    fixtures: document.querySelector(".dashboard-fixtures")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    ownRank: document.querySelector('.rank-row[data-team-id="2959100"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    standingsRows: document.querySelectorAll("[data-ot-rank-list] .rank-row").length
  }));
  const item = { label, at: new Date().toISOString(), visible, manifestRequests: requests.length, frameReports: frames.length };
  snapshots.push(item);
  await page.screenshot({ path: resolve(output, `${label}.png`) });
  writeFileSync(resolve(output, "evidence.json"), JSON.stringify({ schemaVersion: 1, origin, orientation, actualHostedStaging: true, runtime: "Chromium real webplayer", interceptedRequests: 0, physicalAndroid: false, physicalLG: false, periodicIntervalMs: 8000, providerData: "normalized internal fixture", requests, frames, snapshots, errors }, null, 2) + "\n", { mode: 0o600 });
  console.info(JSON.stringify(item));
}

try {
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('[data-player-handoff="first-frame-ready"] [data-sync-ready="true"]', { timeout: 60_000 });
  await snapshot("initial");
  if (evidenceMode === "rank-tail") {
    await page.waitForFunction(() => {
      const viewport = document.querySelector("[data-ot-rank-list]");
      const row = viewport ? [...viewport.querySelectorAll(".rank-row")].at(-1) : null;
      if (!viewport || !row) return false;
      const clip = viewport.getBoundingClientRect(), box = row.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top >= clip.top - 1 && box.bottom <= clip.bottom + 1;
    }, undefined, { timeout: 60_000 });
    await snapshot("rank-tail-visible");
  } else {
    const input = createInterface({ input: process.stdin });
    for await (const label of input) {
      if (label === "close") break;
      await snapshot(label.trim());
    }
  }
} finally {
  await context.close();
  await browser.close();
}
