import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { defaultGoalOverlayConfiguration, type GoalOverlayConfiguration } from "../../packages/contracts/src/goal-overlay";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const token = "g".repeat(48);
const videoId = "33333333-3333-4333-8333-333333333333";
const videoBytes = readFileSync("apps/player/public/lg-probe/h264-baseline-aac.mp4");
const checksum = createHash("sha256").update(videoBytes).digest("hex");
const config: GoalOverlayConfiguration = { ...defaultGoalOverlayConfiguration, overlayDurationMs: 2000, enterAnimation: "none", exitAnimation: "none", transitionDurationMs: 0, defaults: { primary: "#2459ed", darkSurface: "#18233a", modePolicy: { kind: "fixed", mode: "light" }, timezone: "Europe/Amsterdam" } };
const sse = (event: string, value: unknown) => `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
function goal(index: number, configuration: GoalOverlayConfiguration, side: "home" | "away" = "home", assets: unknown[] = []) {
  const now = Date.now();
  return { id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`, alertVersionId: "44444444-4444-4444-8444-444444444444", assets, executeAt: new Date(now + 600).toISOString(), expiresAt: new Date(now + 120000).toISOString(), serverTime: new Date(now).toISOString(), kind: "goal", payload: {
    eventId: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`, eventKind: "synthetic_test", goalOverlay: configuration,
    design: { headline: "GOAL!", palette: "ink-black", animation: "none" }, durationMs: 2000, underlayPolicy: "pause", scoringSide: "own", scoreboardSide: side,
    homeTeam: side === "home" ? "Duindorp SV 2" : "VUC 2", awayTeam: side === "away" ? "Duindorp SV 2" : "VUC 2", homeScore: side === "home" ? 2 : 1, awayScore: side === "away" ? 2 : 1, previousHomeScore: 1, previousAwayScore: 1,
    scorerName: index === 1 ? "Jack Morauw" : null, matchClock: index === 1 ? "67′" : null
  } };
}
async function prepare(page: Page, legacy: boolean, messages: unknown[], preloadConfig?: unknown) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const manifest = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#123456"/></svg>';
  await page.route("**/goal-test-underlay.svg", (r) => r.fulfill({ body: svg, contentType: "image/svg+xml" }));
  await page.route(/\/api\/player\/manifest(?:\?.*)?$/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(legacy ? {
    state: "PLAYING", fetchedAt: new Date().toISOString(), device: { id: "goal-device", screenId: "goal-screen", screenName: "Goal screen", activeReleaseId: "goal-release", desiredReleaseId: "goal-release" },
    manifest: { schemaVersion: 1, tenantId: "goal-tenant", playlistId: "goal-playlist", releaseId: "goal-release", version: 1, label: "Goal test", manifestHash: "a".repeat(64), publishedAt: new Date().toISOString(), totalDurationSeconds: 20, totalBytes: Buffer.byteLength(svg), items: [{ id: "underlay", kind: "image", title: "Playlist onderlaag", durationSeconds: 20, fitMode: "contain", muted: true, source: { url: "/goal-test-underlay.svg", mimeType: "image/svg+xml", bytes: Buffer.byteLength(svg), checksumSha256: createHash("sha256").update(svg).digest("hex") } }] }, diagnostics: { syncStatus: "online" }
  } : manifest) }));
  for (const [endpoint, response] of Object.entries({ installation: { bound: true, installationCredential: "i".repeat(48), ok: true }, heartbeat: { automation: null, ok: true }, commands: { commands: [], ok: true, serverTime: new Date().toISOString() }, "realtime/ack": { ok: true } })) {
    await page.route(`**/api/player/${endpoint}`, (r) => r.fulfill({ body: JSON.stringify(response), contentType: "application/json" }));
  }
  let sent = false;
  await page.route("**/api/player/realtime", (r) => {
    const body = sent ? ": heartbeat\n\n" : sse("bootstrap", { configs: preloadConfig ? [preloadConfig] : [], serverTime: new Date().toISOString() }) + messages.map((m) => sse("goal", m)).join("");
    sent = true;
    return r.fulfill({ body, contentType: "text/event-stream; charset=utf-8", headers: { "Cache-Control": "no-store" } });
  });
  await page.addInitScript(({ token }) => {
    localStorage.setItem("veyocast.player.deviceToken", token);
    localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
    localStorage.setItem("veyocast.player.instanceId", "goal-test-installation");
  }, { token });
  await page.goto(`${playerURL}/${legacy ? "lg/legacy" : `?deviceToken=${token}`}`);
  return errors;
}

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    for (const appearance of ["light", "dark"] as const) {
      test(`${legacy ? "LG" : "React"}: ${orientation} ${appearance}, thuis-/uitgoal en queue zonder reload`, async ({ page }) => {
        await page.setViewportSize(orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
        const c = { ...config, themeMode: appearance };
        const a = goal(1, c);
        const b = goal(2, c, "away");
        const errors = await prepare(page, legacy, [a, a, b]);
        const overlay = page.locator(".vc-goal");
        await expect(overlay).toBeVisible();
        await page.evaluate(() => { document.documentElement.dataset.goalDocument = "preserved"; });
        await expect(overlay).toContainText("Jack Morauw");
        const underlay = page.locator(legacy ? 'img[alt="Playlist onderlaag"]' : 'img[alt="Clubhuis entree"]');
        await expect(underlay).toBeVisible();
        await underlay.evaluate((image) => { image.setAttribute("data-goal-underlay", "preserved"); });
        await expect(overlay).toHaveAttribute("data-orientation", orientation);
        await expect(overlay).toHaveAttribute("data-theme", appearance);
        expect(await overlay.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/^Roboto[,\s]/);
        expect(await overlay.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(36, 89, 237)");
        expect(await overlay.locator(".vc-goal-card").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(appearance === "light" ? "rgb(255, 255, 255)" : "rgb(24, 35, 58)");
        expect(await overlay.evaluate((e) => getComputedStyle(e).color)).toBe(appearance === "light" ? "rgb(36, 89, 237)" : "rgb(255, 255, 255)");
        await page.waitForTimeout(800);
        await expect(overlay).toContainText("Jack Morauw");
        await expect(overlay.locator(".vc-goal-scorer")).toHaveCount(0, { timeout: 5000 });
        await expect(overlay).toBeVisible();
        await expect(overlay.locator(".vc-goal-team-name").first()).toHaveText("VUC 2");
        await expect(overlay.locator(".vc-goal-minute")).toHaveCount(0);
        await expect(overlay).toHaveCount(0, { timeout: 5000 });
        expect(await page.evaluate(() => document.documentElement.dataset.goalDocument)).toBe("preserved");
        expect(errors).toEqual([]);
        await expect(underlay).toHaveAttribute("data-goal-underlay", "preserved");
        await expect(page.locator(legacy ? 'img[alt="Playlist onderlaag"]' : 'img[alt="Clubhuis entree"]')).toBeVisible();
      });
    }
  }
  test(`${legacy ? "LG" : "React"}: intro gebruikt cache, wacht op ended en degradeert bij videofout`, async ({ page }) => {
    const asset = { checksum, mediaAssetId: videoId, mimeType: "video/mp4", url: `${playerURL}/lg-probe/h264-baseline-aac.mp4` };
    await page.addInitScript(({ checksum, data }) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      // Warm the same persistent cache used after receiving configuration.
      (window as unknown as { goalWarm: Promise<void> }).goalWarm = caches.open("veyocast-player-goal-assets-v2").then((c) => c.put(`/__veyocast-goal-cache/${checksum}`, new Response(bytes, { headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length) } })));
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.closest('[data-testid="goal-celebration"],#goal-overlay')) {
          this.dispatchEvent(new Event("playing"));
          return Promise.resolve();
        }
        return play.call(this);
      };
    }, { checksum, data: videoBytes.toString("base64") });
    const c = { ...config, introEnabled: true, introLandscapeMediaId: videoId };
    const errors = await prepare(page, legacy, [goal(1, c, "home", [asset]), goal(2, c, "away", [asset])]);
    const root = page.locator(legacy ? '#goal-overlay[data-renderer="goal-v2"]' : '[data-testid="goal-celebration"]');
    const video = root.locator("video");
    await expect(video).toBeVisible();
    await expect(root.locator(".vc-goal")).toBeHidden();
    expect(await video.getAttribute("src")).toMatch(/^blob:/);
    await page.waitForTimeout(2500);
    await expect(video).toBeVisible();
    await video.evaluate((v) => v.dispatchEvent(new Event("ended")));
    await expect(root.locator(".vc-goal")).toBeVisible();
    await expect(root).toContainText("Jack Morauw");
    await expect(video).toBeVisible({ timeout: 5000 });
    await video.evaluate((v) => v.dispatchEvent(new Event("error")));
    await expect(root.locator(".vc-goal")).toBeVisible();
    await expect(root.locator(".vc-goal-scorer")).toHaveCount(0);
    await expect(root.locator(".vc-goal")).toHaveCount(0, { timeout: 5000 });
    expect(errors).toEqual([]);
  });
  test(`${legacy ? "LG" : "React"}: echte decoder speelt gecachete intro tot natuurlijk ended`, async ({ page }) => {
    const asset = { checksum, mediaAssetId: videoId, mimeType: "video/mp4", url: `${playerURL}/lg-probe/h264-baseline-aac.mp4` };
    let downloads = 0;
    await page.route("**/lg-probe/h264-baseline-aac.mp4", (route) => {
      downloads += 1;
      return route.fulfill({ body: videoBytes, contentType: "video/mp4" });
    });
    await page.addInitScript(({ checksum, data }) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      void caches.open("veyocast-player-goal-assets-v2").then((cache) => cache.put(`/__veyocast-goal-cache/${checksum}`, new Response(bytes, { headers: { "Content-Type": "video/mp4" } })));
      document.addEventListener("ended", (event) => {
        if (event.target instanceof HTMLVideoElement && event.target.closest('[data-testid="goal-celebration"],#goal-overlay')) document.documentElement.dataset.naturalGoalEnded = "true";
      }, true);
    }, { checksum, data: videoBytes.toString("base64") });
    const c = { ...config, introEnabled: true, introLandscapeMediaId: videoId };
    const errors = await prepare(page, legacy, [goal(1, c, "home", [asset])]);
    const root = page.locator(legacy ? '#goal-overlay[data-renderer="goal-v2"]' : '[data-testid="goal-celebration"]');
    await expect(root.locator("video")).toBeVisible();
    await expect(root.locator(".vc-goal")).toBeHidden();
    await expect(root.locator(".vc-goal")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("html")).toHaveAttribute("data-natural-goal-ended", "true");
    expect(downloads).toBe(0);
    await expect(root.locator(".vc-goal")).toHaveCount(0, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

}
