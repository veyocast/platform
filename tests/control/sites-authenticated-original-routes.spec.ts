import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolveFieldflowRedirect } from "../../apps/control/lib/fieldflow-redirects";

// Explicit read-only, disposable local production gate. No demo sessions,
// service-role browser credential, production input or auth bypass is used.
const enabled = process.env.VEYOCAST_SITES_QA_ORIGINAL_ROUTES === "1";
const marketingOnly = process.env.VEYOCAST_SITES_QA_MARKETING_ONLY === "1";
const endpointsOnly = process.env.VEYOCAST_SITES_QA_ENDPOINTS_ONLY === "1";
const control = "http://localhost:3343", marketing = "http://127.0.0.1:3318";
const authPath = "/tmp/veyocast-s191-qa-auth-state.json";
const directory = "/dev/shm/veyocast-s191-original-authenticated-routes";
const readbacks: Record<string, unknown>[] = [], responsive: Record<string, unknown>[] = [];
type CsvRow = Record<string, string>;
function csvRows(path: string): CsvRow[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, ""), rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) { const character = text[index]!; if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; } else if (character === "," && !quoted) { row.push(cell); cell = ""; } else if (character === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += character; }
  const headers = rows.shift()!; return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}
const matrix = csvRows("docs/sites-v11-overname/inventory/VISUAL-CASES.csv");
const uiRoutes = csvRows("docs/sites-v11-overname/inventory/ROUTE-MAPPING.csv").filter(row => ["control", "player", "marketing", "marketing-catalogus", "sites-hash", "control-mobile-native"].includes(row.app!));
let context: BrowserContext;
let resources: Record<string, string>;
test.beforeAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(90_000);
  if (!enabled) return;
  if (marketingOnly || endpointsOnly) {
    // Public Marketing recovery is independent of disposable database/auth
    // maintenance. This branch provides no Control permissions or session.
    resources = {};
    context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam", deviceScaleFactor: 1 });
    return;
  }
  expect(statSync(authPath).mode & 0o777).toBe(0o600);
  const root = JSON.parse(readFileSync("/tmp/veyocast-s191-qa-route-resources.json", "utf8")) as Record<string, unknown>;
  const sources = JSON.parse(readFileSync("/tmp/s191-source-local-qa-resources.json", "utf8")) as Record<string, unknown>;
  expect(root.environment).toBe("disposable-local-56521"); expect(root.providerSuccessClaim).toBe(false);
  resources = {
    screenId: "19170000-0000-4000-8000-000000000020", tenantId: "19170000-0000-4000-8000-000000000010", ticketId: "93ab48a8-d547-48f0-bb10-54a9990eb5fc", templateId: "94b68632-2416-4f87-9c3b-f1cfc1f8869c",
    playlistId: String(root.playlistId), releaseId: String(root.releaseId), designId: String(root.designId), publicId: String(root.engagePublicId), importId: String(sources.importId),
    slideId: String((sources.genericSlide as { slideId: string }).slideId), menuSlideId: String(sources.menuSlideId), alertId: String((sources.alert as { alertId: string }).alertId)
  };
  for (const value of Object.values(resources)) expect(value).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  const state = JSON.parse(readFileSync(authPath, "utf8"));
  state.cookies = state.cookies.map((cookie: { domain: string }) => cookie.domain === "127.0.0.1" ? { ...cookie, domain: "localhost" } : cookie);
  context = await browser.newContext({ storageState: state, locale: "nl-NL", timezoneId: "Europe/Amsterdam", deviceScaleFactor: 1 });
  const page = await context.newPage(); await page.goto(`${control}/context`); await page.getByRole("button", { name: "Open vereniging" }).first().click(); await expect(page).toHaveURL(/\/dashboard$/); await page.close();
});
function persist(name: string, results: Record<string, unknown>[]) {
  if (!enabled) return;
  mkdirSync(directory, { recursive: true }); const path = join(directory, name), merged = new Map<string, Record<string, unknown>>();
  if (existsSync(path)) for (const row of JSON.parse(readFileSync(path, "utf8")).results as Record<string, unknown>[]) merged.set(String(row.caseId), row);
  for (const row of results) merged.set(String(row.caseId), row);
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", implementationBaseSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), fixtureVersion: "QA-01-actual-local-AAL2-Supabase-20261011", timezone: "Europe/Amsterdam", browser: "Chromium1228 / Linux / DPR1", localOnly: true, providerSuccessClaim: false, sourceGoldenCompared: false, scope: "Actual production Control3343 and Marketing3318, genuine AAL2 tenant/platform roles and persisted guarded QA resources. Original route title/actions/active navigation/scroll/overflow and retained guard assertions. Sourcepixel parity, source/provider success and physical/native acceptance separate.", results: [...merged.values()].sort((a, b) => String(a.caseId).localeCompare(String(b.caseId))) }, null, 2));
}
test.afterAll(async () => { await context?.close(); });
function populate(path: string) {
  for (const [key, id] of Object.entries(resources)) path = path.replaceAll(`[${key}]`, key === "slideId" && path.includes("menu-studio") ? resources.menuSlideId! : id);
  return path;
}
function expectedPath(path: string) {
  if (path === "/dashboard/account/mfa") return "/auth/mfa";
  if (path === "/dashboard/slides/new") return "/dashboard/studio/new";
  if (/^\/dashboard\/slides\/[^/]+\/edit$/.test(path)) return path.slice(0, -5);
  if (path === "/dashboard/settings/billing/return") return "/dashboard/settings/billing";
  if (path === "/mobile/pair") return "/dashboard/screens/new";
  if (path === "/") return "/dashboard";
  if (path === "/onboarding") return "/context";
  return resolveFieldflowRedirect(path) ?? path;
}
async function inspect(page: Page, path: string, app: string, row: CsvRow) {
  const [width, height] = row.viewport!.split("x").map(Number); await page.setViewportSize({ width: width!, height: height! });
  const origin = app.startsWith("marketing") ? marketing : control;
  const response = await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  const destination = app.startsWith("marketing") ? path : expectedPath(path);
  await expect(page).toHaveURL(url => url.pathname === destination, { timeout: 15000 });
  const finalPath = new URL(page.url()).pathname;
  expect(finalPath).toBe(destination); expect(response?.status()).toBeLessThan(400);
  // The original Sites editor is a native modal dialog with its own h2 title;
  // showModal intentionally makes the page h1/background inaccessible.
  const editor = page.getByRole("dialog", { name: "Playlist bewerken", exact: true });
  if (/^\/dashboard\/playlists\/[0-9a-f-]{36}$/.test(finalPath)) await expect(editor).toBeVisible();
  const headings = await editor.isVisible() ? editor.locator("h2:visible") : page.locator("h1:visible");
  await expect(headings.first()).toBeVisible(); const titles = await headings.allTextContents(); expect(titles.some(title => title.trim().length > 0)).toBe(true);
  const chrome = page.locator(".vx-header:visible"); if (finalPath.startsWith("/dashboard") || finalPath.startsWith("/platform")) await expect(chrome).toHaveCount(1);
  const active = await page.locator('[aria-current="page"]:visible').allTextContents();
  if (chrome && await chrome.count() && !finalPath.startsWith("/context")) expect(active.length, `${path} behoudt actieve navigatie`).toBeGreaterThan(0);
  const actions = await page.locator('main button:visible,main a:visible,[role="dialog"] button:visible,[role="dialog"] a:visible').evaluateAll(elements => elements.map(element => ({ label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 150) ?? "", disabled: element instanceof HTMLButtonElement && element.disabled, href: element instanceof HTMLAnchorElement ? new URL(element.href).origin === location.origin ? new URL(element.href).pathname : "external" : null })));
  expect(actions.length, `${path} behoudt zichtbare acties of herstelroute`).toBeGreaterThan(0);
  const scroll = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll<HTMLElement>('body,main,[role="dialog"],main *,[role="dialog"] *')].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && ["auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1; });
    const scroller = document.scrollingElement;
    if (scroller instanceof HTMLElement && scroller.scrollHeight > scroller.clientHeight + 1 && !["hidden", "clip"].includes(getComputedStyle(scroller).overflowY) && !candidates.includes(scroller)) candidates.push(scroller);
    return candidates.map(element => {
      const initial = element.scrollTop, behavior = element.style.scrollBehavior;
      // Remove animation only during this reachability measurement. A smooth
      // scroll's first frame is not evidence that the page cannot reach its end.
      element.style.scrollBehavior = "auto"; element.scrollTop = element.scrollHeight;
      const result = { maximum: element.scrollHeight - element.clientHeight, actual: element.scrollTop };
      element.scrollTop = initial; element.style.scrollBehavior = behavior; return result;
    });
  });
  for (const container of scroll) expect(container.actual).toBeGreaterThanOrEqual(container.maximum - 1);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 })); expect(geometry.horizontalOverflow).toBe(false);
  const font = await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily); expect(font).toMatch(/Inter|Manrope/);
  // Never persist auth QR secrets; MFA GET without enrollment normally has none.
  expect(await page.locator(".mfa-secret:visible").count()).toBe(0);
  mkdirSync(directory, { recursive: true }); const screenshot = join(directory, `${row.case_id}.png`); await page.screenshot({ path: screenshot, fullPage: true });
  return { path, finalPath, httpStatus: response?.status(), titles, activeNavigation: active, actions, scroll, geometry, font, screenshot, screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex") };
}

test.describe("Actual original routes with genuine disposable local AAL2", () => {
  test.skip(!enabled, "Requires explicitly authorized disposable local production/API/MFA fixture.");
  for (const row of matrix.filter(row => row.case_id?.startsWith("ROUTE-"))) {
    const mapping = uiRoutes[Math.floor((Number(row.case_id!.slice(6)) - 1) / 2)]!;
    test(`${row.case_id} ${mapping.app} ${row.viewport} ${row.production_route}`, async () => {
      test.setTimeout(60000);
      test.skip(marketingOnly && !mapping.app!.startsWith("marketing") && row.production_route !== "Marketing /", "Marketing-only recovery does not provision a Control session.");
      if (mapping.app === "control-mobile-native" || mapping.app === "player") { readbacks.push({ caseId: row.case_id, status: "BLOCKED", setup: row.setup, expected: row.assertions, viewport: row.viewport, blocker: mapping.app === "control-mobile-native" ? "BLOCKED_MISSING_NATIVE_RUNTIME_HARDWARE: Metro/types/unit exports are separate; no physical/native page acceptance inferred." : "Player route/first-frame/offline acceptance is executed in the separate Player gate; this read-only Control/Marketing gate does not impersonate a paired device." }); persist("case-readback.json", readbacks.slice(-1)); test.skip(true, "Separate genuine Player/native runtime acceptance required."); }
      const page = await context.newPage();
      try {
        let paths = row.production_route!.split(";").map(path => populate(path.trim())), app = mapping.app!;
        if (app === "sites-hash" && row.production_route === "Marketing /") { app = "marketing"; paths = ["/"]; }
        if (app.startsWith("marketing") && paths[0] === "/[...slug]") paths = ["/product"];
        if (app.startsWith("marketing") && ["/blog/[slug]", "/cases/[slug]"].includes(paths[0]!)) {
          const path = paths[0]!.replace("[slug]", "sites-local-unpublished-qa"); const response = await page.goto(marketing + path); expect(response?.status()).toBe(404); await expect(page.getByRole("heading", { level: 1, name: "Dit scherm staat niet in de playlist." })).toBeVisible(); await expect(page.getByRole("link", { name: "Naar de homepage" })).toBeVisible();
          readbacks.push({ caseId: row.case_id, status: "NOT_APPLICABLE", setup: row.setup, expected: row.assertions, viewport: row.viewport, actual: "Approved publishedBlogPosts/publishedCases catalogs are intentionally empty; genuine unpublished404 confirmed. No fictitious public post/customer case created. Approved-content page acceptance requires supplied approved input." }); return;
        }
        const results = []; for (const path of paths) { expect(path).not.toContain("["); results.push(await inspect(page, path, app, row)); }
        readbacks.push({ caseId: row.case_id, status: "PASS", setup: row.setup, expected: row.assertions, viewport: row.viewport, app: mapping.app, sourceGoldenCompared: false, results });
      } catch (error) { readbacks.push({ caseId: row.case_id, status: "FAIL", setup: row.setup, expected: row.assertions, viewport: row.viewport, blocker: error instanceof Error ? error.message.slice(0, 1200) : "Browser assertion failed" }); throw error; }
      finally { persist("case-readback.json", readbacks.filter(result => result.caseId === row.case_id).slice(-1)); await page.close(); }
    });
  }
  for (const row of matrix.filter(row => row.case_id?.startsWith("RESP-"))) test(`${row.case_id} ${row.viewport} ${row.reference_route}`, async () => {
    const path = row.reference_route === "#/website" ? "/" : row.reference_route!.slice(1), app = row.reference_route === "#/website" ? "marketing" : "control", page = await context.newPage();
    try { const result = await inspect(page, path, app, row); responsive.push({ caseId: row.case_id, status: "PASS", viewport: row.viewport, setup: row.setup, expected: row.assertions, sourceGoldenCompared: false, assertionScope: "Actual authenticated QA layout/typography/active navigation/scroll/primary actions/no horizontal overflow. Data-dependent counts and pending/offline facts remain genuine; sourcepixel equality separate.", result }); }
    catch (error) { responsive.push({ caseId: row.case_id, status: "FAIL", viewport: row.viewport, setup: row.setup, expected: row.assertions, blocker: error instanceof Error ? error.message.slice(0, 1000) : "Responsive assertion failed" }); throw error; }
    finally { persist("responsive-readback.json", responsive.filter(result => result.caseId === row.case_id).slice(-1)); await page.close(); }
  });
  test("Meldingen actual active-tenant RLS readback excludes private audit fields and ignores foreign tenant input", async () => {
    const response = await context.request.get(`${control}/api/control/notifications?tenant_id=19170000-0000-4000-8000-000000000011`); expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("private, no-store"); const payload = await response.json(); expect(payload.tenantId).toBe(resources.tenantId); expect(payload.notifications.length).toBeLessThanOrEqual(20); expect(Object.keys(payload).sort()).toEqual(["notifications", "tenantId"]); for (const item of payload.notifications) expect(Object.keys(item).sort()).toEqual(["createdAt", "href", "id", "result", "title"]);
  });
});

// Explicit stateless negative probes for all original API-only inventory rows.
// No authenticated cookie/device credential/worker token is supplied. POST
// bodies are deliberately invalid and have a foreign Origin; no success
// mutation or real provider call is part of this preservation gate.
const originalEndpoints = [
  {
    "app": "control-endpoint",
    "route": "/api/billing/mollie/webhook",
    "path": "/api/billing/mollie/webhook",
    "method": "POST",
    "statuses": [
      400
    ],
    "implementationPath": "apps/control/app/api/billing/mollie/webhook/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/engage/[publicId]",
    "path": "/api/engage/invalid-s191-no-resource",
    "method": "POST",
    "statuses": [
      400
    ],
    "implementationPath": "apps/control/app/api/engage/[publicId]/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/health",
    "path": "/api/health",
    "method": "GET",
    "statuses": [
      200,
      503
    ],
    "implementationPath": "apps/control/app/api/health/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/internal/billing/cycle",
    "path": "/api/internal/billing/cycle",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/internal/billing/cycle/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/internal/billing/notifications",
    "path": "/api/internal/billing/notifications",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/internal/billing/notifications/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/internal/billing/outbox",
    "path": "/api/internal/billing/outbox",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/internal/billing/outbox/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/internal/billing/reconcile",
    "path": "/api/internal/billing/reconcile",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/internal/billing/reconcile/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/labs/led-scores/live-image/[token]",
    "path": "/api/labs/led-scores/live-image/invalid-s191-no-resource",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/control/app/api/labs/led-scores/live-image/[token]/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/media/images",
    "path": "/api/media/images",
    "method": "POST",
    "statuses": [
      401,
      403
    ],
    "implementationPath": "apps/control/app/api/media/images/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/account/deletion",
    "path": "/api/mobile/v1/account/deletion",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/account/deletion/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/cockpit",
    "path": "/api/mobile/v1/cockpit",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/cockpit/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/content",
    "path": "/api/mobile/v1/content",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/content/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/engage",
    "path": "/api/mobile/v1/engage",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/engage/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/media/images",
    "path": "/api/mobile/v1/media/images",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/media/images/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/notifications/device",
    "path": "/api/mobile/v1/notifications/device",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/notifications/device/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/notifications/preferences",
    "path": "/api/mobile/v1/notifications/preferences",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/notifications/preferences/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/pairing/claim",
    "path": "/api/mobile/v1/pairing/claim",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/pairing/claim/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/playlists/[playlistId]/publish",
    "path": "/api/mobile/v1/playlists/invalid-s191-no-resource/publish",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/playlists/[playlistId]/publish/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/playlists/[playlistId]",
    "path": "/api/mobile/v1/playlists/invalid-s191-no-resource",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/playlists/[playlistId]/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/playlists",
    "path": "/api/mobile/v1/playlists",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/playlists/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/screens/commands",
    "path": "/api/mobile/v1/screens/commands",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/screens/commands/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/screens",
    "path": "/api/mobile/v1/screens",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/screens/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/mobile/v1/session",
    "path": "/api/mobile/v1/session",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/mobile/v1/session/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/products/import",
    "path": "/api/products/import",
    "method": "POST",
    "statuses": [
      401,
      403
    ],
    "implementationPath": "apps/control/app/api/products/import/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/products/logos",
    "path": "/api/products/logos",
    "method": "POST",
    "statuses": [
      401,
      403
    ],
    "implementationPath": "apps/control/app/api/products/logos/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/search",
    "path": "/api/search",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/search/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/api/support-bundle",
    "path": "/api/support-bundle",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/control/app/api/support-bundle/route.ts"
  },
  {
    "app": "control-endpoint",
    "route": "/auth/confirm",
    "path": "/auth/confirm",
    "method": "GET",
    "statuses": [
      307
    ],
    "implementationPath": "apps/control/app/auth/confirm/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/device-lab/runs",
    "path": "/api/device-lab/runs",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/device-lab/runs/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/device-lab/session",
    "path": "/api/device-lab/session",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/player/app/api/device-lab/session/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/health",
    "path": "/api/health",
    "method": "GET",
    "statuses": [
      200,
      503
    ],
    "implementationPath": "apps/player/app/api/health/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/commands",
    "path": "/api/player/commands",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/commands/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/demo/manifest",
    "path": "/api/player/demo/manifest",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/player/app/api/player/demo/manifest/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/demo/media",
    "path": "/api/player/demo/media",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/player/app/api/player/demo/media/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/demo/session",
    "path": "/api/player/demo/session",
    "method": "POST",
    "statuses": [
      401,
      404
    ],
    "implementationPath": "apps/player/app/api/player/demo/session/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/engage/[publicId]/qr",
    "path": "/api/player/engage/invalid-s191-no-resource/qr",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/player/app/api/player/engage/[publicId]/qr/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/engage/[publicId]",
    "path": "/api/player/engage/invalid-s191-no-resource",
    "method": "GET",
    "statuses": [
      404
    ],
    "implementationPath": "apps/player/app/api/player/engage/[publicId]/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/heartbeat",
    "path": "/api/player/heartbeat",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/heartbeat/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/installation",
    "path": "/api/player/installation",
    "method": "POST",
    "statuses": [
      400
    ],
    "implementationPath": "apps/player/app/api/player/installation/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/manifest",
    "path": "/api/player/manifest",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/manifest/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/pairing/qr",
    "path": "/api/player/pairing/qr",
    "method": "GET",
    "statuses": [
      400
    ],
    "implementationPath": "apps/player/app/api/player/pairing/qr/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/pairing/recover",
    "path": "/api/player/pairing/recover",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/pairing/recover/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/pairing",
    "path": "/api/player/pairing",
    "method": "POST",
    "statuses": [
      200,
      401
    ],
    "implementationPath": "apps/player/app/api/player/pairing/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/pairing/unpair",
    "path": "/api/player/pairing/unpair",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/pairing/unpair/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/realtime/ack",
    "path": "/api/player/realtime/ack",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/realtime/ack/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/realtime",
    "path": "/api/player/realtime",
    "method": "GET",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/realtime/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/api/player/sponsor-events",
    "path": "/api/player/sponsor-events",
    "method": "POST",
    "statuses": [
      401
    ],
    "implementationPath": "apps/player/app/api/player/sponsor-events/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/healthz",
    "path": "/healthz",
    "method": "GET",
    "statuses": [
      200,
      503
    ],
    "implementationPath": "apps/player/app/healthz/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/lg/html-debug",
    "path": "/lg/html-debug",
    "method": "GET",
    "statuses": [
      200
    ],
    "implementationPath": "apps/player/app/lg/html-debug/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/lg/legacy",
    "path": "/lg/legacy",
    "method": "GET",
    "statuses": [
      200
    ],
    "implementationPath": "apps/player/app/lg/legacy/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/lg/probe",
    "path": "/lg/probe",
    "method": "GET",
    "statuses": [
      200
    ],
    "implementationPath": "apps/player/app/lg/probe/route.ts"
  },
  {
    "app": "player-endpoint",
    "route": "/lg/recover",
    "path": "/lg/recover",
    "method": "GET",
    "statuses": [
      200
    ],
    "implementationPath": "apps/player/app/lg/recover/route.ts"
  },
  {
    "app": "marketing-endpoint",
    "route": "/api/health",
    "path": "/api/health",
    "method": "GET",
    "statuses": [
      200,
      503
    ],
    "implementationPath": "apps/marketing/app/api/health/route.ts"
  },
  {
    "app": "marketing-endpoint",
    "route": "/inloggen",
    "path": "/inloggen",
    "method": "GET",
    "statuses": [
      307
    ],
    "implementationPath": "apps/marketing/app/inloggen/route.ts"
  }
] as const;
test.describe("Original endpoint fail-closed preservation", () => {
  test.skip(!enabled || !endpointsOnly, "Requires the explicit stateless local endpoint gate.");
  for (const endpoint of originalEndpoints) test(`original endpoint ${endpoint.app} ${endpoint.route}`, async () => {
    const origin = endpoint.app === "control-endpoint" ? control : endpoint.app === "player-endpoint" ? "http://127.0.0.1:3316" : marketing;
    const response = await context.request.fetch(origin + endpoint.path, {
      method: endpoint.method, maxRedirects: 0, timeout: 15000,
      headers: { Origin: "https://invalid.s191.example", "Content-Type": "application/json" },
      ...(endpoint.method === "POST" ? { data: "{}" } : {})
    });
    expect([...endpoint.statuses], `${endpoint.route} uses its documented public or negative guard`).toContain(response.status());
    const body = await response.text();
    expect(body).not.toMatch(/eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    let boundary = response.status() >= 400 ? "Actual unauthenticated or invalid-input rejection; successful semantics remain separate." : "Public health/diagnostic or login redirect; no tenant write/device binding/provider success.";
    if (endpoint.route === "/api/player/pairing" && response.status() === 200) {
      const data = JSON.parse(body); expect(data.live).toBe(false); expect(data.deviceToken).toBeUndefined();
      boundary = "Explicit unconfigured Player mode: live=false and no device token; no installation/pairing/session RPC.";
    }
    if (endpoint.route.startsWith("/lg/")) {
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers()["content-security-policy"]).toContain("object-src 'none'");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    }
    if (endpoint.route === "/inloggen" || endpoint.route === "/auth/confirm") {
      const destination = new URL(response.headers().location!, origin);
      expect(destination.protocol).toMatch(/^https?:$/); expect(destination.username + destination.password).toBe("");
      expect(destination.searchParams.has("token_hash")).toBe(false);
    }
    persist("endpoints-readback.json", [{ caseId: `${endpoint.app}:${endpoint.route}`, route: endpoint.route, implementationPath: endpoint.implementationPath, method: endpoint.method, status: "PASS", httpStatus: response.status(), noCredentialSupplied: true, successfulMutationClaim: false, providerSuccessClaim: false, physicalHardwareClaim: false, boundary }]);
  });
});
