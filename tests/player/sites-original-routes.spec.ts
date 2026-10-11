import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const enabled = process.env.VEYOCAST_SITES_PLAYER_ORIGINAL_ROUTES === "1";
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const directory = process.env.SITES_PLAYER_ROUTE_EVIDENCE_DIRECTORY ?? "/dev/shm/veyocast-s191-original-player-routes";
const readbacks: Record<string, unknown>[] = [];
type CsvRow = Record<string, string>;
function csvRows(input: string): CsvRow[] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === "," || c === "\n")) { row.push(field.replace(/\r$/, "")); field = ""; if (c === "\n") { rows.push(row); row = []; } }
    else field += c;
  }
  const headers = rows.shift()!;
  return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((name, i) => [name, row[i] ?? ""])));
}
const matrix = csvRows(readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8"))
  .filter(row => /^ROUTE-01(?:7[7-9]|8[0-6])$/u.test(row.case_id!));

test.afterAll(() => {
  if (!enabled) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "case-readback.json"), JSON.stringify({
    schemaVersion: 1, sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc",
    implementationBaseSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    capturedAt: new Date().toISOString(), browser: "Chromium1228 / Linux / DPR1", localOnly: true,
    sourceGoldenCompared: false, physicalHardwareClaim: false, providerSuccessClaim: false,
    scope: "Original Player routes and viewports on the actual production Next build. Default setup, device transport, review-session and diagnostic guards, thumbnail input boundary, visible titles and overflow. Pairing responses are controlled device-only fixtures. Playback/LKG/rollback acceptance remains separate.",
    results: readbacks
  }, null, 2));
});

for (const row of matrix) test(`${row.case_id}: production Player ${row.production_route} ${row.viewport}`, async ({ page }) => {
  test.skip(!enabled, "Explicit original Player route gate.");
  const [width, height] = row.viewport!.split("x").map(Number);
  await page.setViewportSize({ width: width!, height: height! });
  const authRequests: string[] = [];
  page.on("request", request => { if (/\/auth\/v1\//u.test(request.url())) authRequests.push(new URL(request.url()).pathname); });
  await page.route("**/api/player/installation", route => route.fulfill({ json: { bound: false, live: true, ok: true, installationCredential: "i".repeat(43) } }));
  await page.route("**/api/player/pairing", route => route.fulfill({ json: { deviceToken: "p".repeat(43), expiresAt: new Date(Date.now() + 60_000).toISOString(), live: true, pairingCode: "QA1 234" } }));
  await page.route("**/api/player/heartbeat", route => route.fulfill({ status: 403, json: { ok: false } }));
  const response = await page.goto(playerURL + row.production_route, { waitUntil: "domcontentloaded" });
  let boundary: string;
  if (row.production_route === "/device-lab") {
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page could not be found" })).toBeVisible();
    const denied = await page.request.post(playerURL + "/api/device-lab/runs", { data: { runId: "original-route-denied" } });
    expect(denied.status()).toBe(401);
    boundary = "Default diagnostic route remains hidden without its HttpOnly device-lab session; unprivileged result write denied.";
  } else if (row.production_route === "/thumbnail") {
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Ongeldige thumbnailpayload", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.thumbnailError)).toBe("invalid_payload");
    expect(await page.evaluate(() => document.documentElement.dataset.thumbnailReady)).not.toBe("true");
    boundary = "Default missing payload fails closed and never signals thumbnail readiness.";
  } else {
    expect(response?.status()).toBe(200);
    if (row.production_route === "/demo") {
      expect(new URL(page.url()).pathname).toBe("/");
      const denied = await page.request.get(playerURL + "/api/player/demo/media");
      expect(denied.status()).toBe(404);
      boundary = "Default review route requires its separate review session and redirects to device setup; review media remains hidden.";
    } else boundary = "Default runtime uses device-only installation/pairing transport and retains the pairing screen.";
    await expect(page.getByRole("main", { name: "VeyoCast player setup" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })).toBeVisible();
    await expect(page.getByLabel("Pairingcode")).toContainText("QA1 234");
    await expect(page.getByRole("img", { name: "QR-code met tijdelijke VeyoCast-koppelcode" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Aanmelden|Inloggen/u })).toHaveCount(0);
  }
  const geometry = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    verticalOverflow: document.documentElement.scrollHeight > window.innerHeight,
    title: document.title,
    visibleText: (document.querySelector("main")?.textContent ?? "").slice(0, 300)
  }));
  expect(geometry.horizontalOverflow).toBe(false);
  expect(geometry.verticalOverflow).toBe(false);
  expect(authRequests).toEqual([]);
  mkdirSync(directory, { recursive: true });
  const screenshot = await page.screenshot({ path: join(directory, `${row.case_id}.png`) });
  readbacks.push({ caseId: row.case_id, status: "PASS", route: row.production_route, finalPath: new URL(page.url()).pathname,
    viewport: row.viewport, responseStatus: response?.status(), boundary, geometry,
    humanAuthRequests: authRequests.length, screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    scope: "Default route and preservation guard acceptance; no independent Source-golden or operational playback claim." });
});
