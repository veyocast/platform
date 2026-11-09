import { expect, test, type Page, type Route } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { syncDomDescriptorMimeType, syncSlidePresentationSchema, syncSlideRendererAssets } from "@veyocast/contracts";
import type { PlayerManifestEnvelope, PlayerManifestItem } from "../../apps/player/app/_lib/player-manifest";
import { createSyncTemplatePreview } from "../../apps/control/app/(shell)/dashboard/studio/sync-template-preview";
import { routeLandscapeRssManifest } from "./rss-portrait-fixture";

const origin = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const uuid = (n: number) => `29500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Platform = "browser" | "static-lg";
type Family = "news" | "sport_results";
type SetupOptions = {
  transform?: (envelope: PlayerManifestEnvelope, revision: number) => PlayerManifestEnvelope;
  changeOnFirstActivation?: boolean;
};

test("an unchanged 200 during first-frame preparation does not restart playback or create a request loop", async ({ page }) => {
  // This existing fixture always returns 200, including between renderer
  // readiness and the two animation frames that confirm actual visibility.
  await routeLandscapeRssManifest(page, origin);
  await page.addInitScript(() => {
    Object.assign(window, { activationStartupReset: false });
    new MutationObserver(() => {
      if (document.querySelector("[data-player-transition-outgoing]")) {
        (window as unknown as { activationStartupReset: boolean }).activationStartupReset = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  let requests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/player/manifest") requests++; });
  await page.goto(`${origin}/?deviceToken=demo-online&syncMs=60000`);
  const slide = page.getByLabel("Dynamisch voetbalnieuws", { exact: true });
  await expect(slide).toBeVisible();
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
  await slide.evaluate(element => element.setAttribute("data-startup-instance", "preserved"));
  const observed = requests;
  await page.waitForTimeout(500);
  await expect(slide).toHaveAttribute("data-startup-instance", "preserved");
  expect(requests).toBe(observed);
  expect(requests).toBeLessThanOrEqual(3);
  expect(await page.evaluate(() => (window as unknown as { activationStartupReset: boolean }).activationStartupReset)).toBe(false);
});

function dynamicItem(base: PlayerManifestItem, family: Family, title: string, revision = 1): PlayerManifestItem {
  return { ...base, id: "repeated-dynamic-slide", durationSeconds: 5, transition: "cut",
    dynamicTemplate: { schemaVersion: 1, snapshotId: uuid(20), templateVersionId: uuid(21),
      snapshotHash: String(revision).repeat(64), templateSlug: `editorial-arena-${family === "news" ? "nieuws" : "uitslagen"}-light-landscape`,
      orientation: "landscape", slideType: family, assets: {},
      data: { type: family, brand: { clubName: "Activeringsproef" },
        ...(family === "news" ? { news: { title: "Nieuws", secondsPerSlide: 5, articles: [
          { externalId: "article-1", title, intro: "Gecontroleerde lokale inhoud", sourceName: "Testredactie", link: "https://example.com/nieuws" }
        ] } } : { sport: { title: "Uitslagen", items: [
          { id: "match-1", primary: `${title} – Tegenstander`, homeTeam: title, awayTeam: "Tegenstander", status: "finished", homeScore: revision, awayScore: 0 }
        ] } }) }
    } };
}

/** The actual web and standalone LG runtimes, with only the authorized origin
 * responses controlled. Sixty-second polling cannot explain five-second checks. */
async function setup(page: Page, platform: Platform, family: Family = "news", repeated = false, zones = false, deviceIndex = 0, options: SetupOptions = {}) {
  const base = await (await page.request.get(`${origin}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
  const make = (revision: number): PlayerManifestEnvelope => {
    const item = dynamicItem(base.manifest.items[0]!, family, `Zichtbaar ${revision}`, revision);
    const envelope: PlayerManifestEnvelope = { ...base,
      device: { ...base.device, id: uuid(100 + deviceIndex), screenId: uuid(200 + deviceIndex), desiredReleaseId: uuid(1) },
      target: { revision: "1", configRevision: "1", publicationId: uuid(2), assignmentSource: "default", committedAt: new Date().toISOString() },
      manifest: { ...base.manifest, releaseId: uuid(1), playlistId: uuid(11), items: repeated
        ? [dynamicItem(base.manifest.items[0]!, family, "Herhaalde A"), dynamicItem(base.manifest.items[0]!, family, "Herhaalde B")]
        : [item] }
    };
    if (zones) {
      envelope.manifest.items = [{ ...base.manifest.items[0]!, id: "unchanged-main", durationSeconds: 120, accessibilityName: "Hoofdzone blijft spelen" }];
      const side = { ...base, device: envelope.device, manifest: { ...base.manifest, releaseId: uuid(3), playlistId: uuid(13), items: [item] } };
      const bottom = { ...base, device: envelope.device, manifest: { ...base.manifest, releaseId: uuid(4), playlistId: uuid(14), items: [{ ...dynamicItem(base.manifest.items[0]!, "sport_results", "Poulewedstrijd", revision), durationSeconds: 7 }] } };
      envelope.composition = { published: { id: uuid(5), revision: 1,
        configuration: { schemaVersion: 1, layout: "three", orientation: "landscape", mainWidthPercent: 70, bottomHeightPercent: 20,
          zones: [{ id: "main", playlistId: uuid(11) }, { id: "side", playlistId: uuid(13) }, { id: "bottom", playlistId: uuid(14) }] },
        bindings: [{ zoneId: "main", releaseId: uuid(1), playlistId: uuid(11), publicationId: uuid(2), configRevision: 1 },
          { zoneId: "side", releaseId: uuid(3), playlistId: uuid(13), publicationId: uuid(6), configRevision: 1 },
          { zoneId: "bottom", releaseId: uuid(4), playlistId: uuid(14), publicationId: uuid(7), configRevision: 1 }] }, zones: { side, bottom } };
    }
    return options.transform?.(envelope, revision) ?? envelope;
  };
  let desired = make(1);
  let offline = false;
  let held: Route | undefined;
  let holdNext = false;
  let heldEnvelope: PlayerManifestEnvelope | undefined;
  const requests: Array<{ correlationId: string; at: number; conditional: string | undefined; status: number; revision: number }> = [];
  const heartbeats: Array<Record<string, unknown>> = [];
  let revision = 1;
  let authorized = true;
  const credential = String.fromCharCode(97 + deviceIndex).repeat(48);
  await page.addInitScript(({ credential, builtRuntime }) => {
    localStorage.setItem("veyocast.player.deviceToken", credential);
    localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
    if (builtRuntime) {
      // Production correctly ignores development query overrides. Extend its
      // 8 s (+ jitter) poll only inside this browser fixture, leaving playback,
      // request deadlines and zero-delay coalesced follow-ups untouched.
      const original = window.setTimeout.bind(window);
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
        original(handler, delay !== undefined && delay >= 8_000 && delay <= 8_750 ? 60_000 : delay, ...args)) as typeof window.setTimeout;
    }
  }, { credential, builtRuntime: process.env.PLAYWRIGHT_PRODUCTION_SERVERS === "1" });
  await page.route("**/api/player/installation", route => route.fulfill({ json: { ok: true, bound: true, installationCredential: "i".repeat(48) } }));
  await page.route("**/api/player/heartbeat", route => { heartbeats.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.route("**/api/player/composition/ack", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/player/commands*", route => route.fulfill({ json: { commands: [], serverTime: new Date().toISOString() } }));
  await page.route("**/api/player/realtime", route => route.fulfill({ status: 204 }));
  await page.route("**/api/player/manifest*", route => {
    if (options.changeOnFirstActivation && requests.length === 1) { revision = 2; desired = make(2); }
    authorized &&= route.request().headers().authorization === `Bearer ${credential}`;
    const conditional = route.request().headers()["if-none-match"];
    const etag = `"activation-${revision}"`;
    const status = offline ? 503 : conditional === etag ? 304 : 200;
    requests.push({ correlationId: `activation-fixture-${deviceIndex}-${requests.length + 1}`, at: Date.now(), conditional, status, revision });
    if (holdNext) { holdNext = false; held = route; heldEnvelope = structuredClone(desired); return; }
    return route.fulfill(status === 200 ? { json: desired, headers: { ETag: etag } }
      : { status, body: "", headers: { ETag: etag, ...(offline ? { "Retry-After": "30" } : {}) } });
  });
  if (platform === "static-lg") await page.route(`${origin}/lg/legacy`, async route => {
    const response = await route.fetch();
    const html = await response.text();
    expect(html).toContain('"manifestIntervalMs":8000');
    await route.fulfill({ response, body: html.replace('"manifestIntervalMs":8000', '"manifestIntervalMs":60000') });
  });
  await page.goto(platform === "browser" ? `${origin}/?syncMs=60000` : `${origin}/lg/legacy`);
  return { requests, heartbeats, make, get authorized() { return authorized; }, setRevision(value: number) { revision = value; desired = make(value); },
    setOffline(value: boolean) { offline = value; }, holdNext() { holdNext = true; },
    get held() { return Boolean(held); },
    async releaseHeld() { await held?.fulfill({ json: heldEnvelope, headers: { ETag: '"activation-1"' } }).catch(() => undefined); held = undefined; } };
}

function zone(page: Page, platform: Platform, id: "side" | "bottom") {
  return platform === "static-lg" ? page.frameLocator(`.lg-screen-composition.visible:not(.retiring) iframe[data-lg-composition-zone="${id}"]`) : page;
}

/** Delay only the actual Sync main renderer's verified font preparation. Byte
 * download, manifest hydration and the ordinary RSS side renderer remain live. */
async function delayedMainRenderer(page: Page) {
  // Establish the real offline shell before instrumenting its first renderer;
  // the cold installation gate must remain independent of this font delay.
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve =>
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true })
    );
  });
  const presentation = (revision: number) => syncSlidePresentationSchema.parse({
    ...createSyncTemplatePreview("menu"), rows: [[`Eerste hoofdframe ${revision}`, "€ 2,50", "", ""]],
    club: { name: "Eerste-frameproef" }, rich: undefined, style: { motion: "geen" }
  });
  const initial = presentation(1), descriptor = JSON.stringify({ schemaVersion: 2, presentation: initial });
  const descriptorHash = createHash("sha256").update(descriptor).digest("hex");
  await page.route("**/__s295-early-source.json", route => route.fulfill({ body: descriptor, contentType: syncDomDescriptorMimeType }));
  await page.addInitScript(() => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const proof = { loads: 0, release, firstVisibleHashes: [] as string[] };
    Object.assign(window, { earlyMainProof: proof });
    const load = FontFace.prototype.load;
    FontFace.prototype.load = function () {
      const loaded = load.call(this);
      if (!this.family.startsWith("OT")) return loaded;
      proof.loads++;
      return loaded.then(face => gate.then(() => face));
    };
    new MutationObserver(() => {
      const root = document.querySelector<HTMLElement>('[data-player-handoff="first-frame-ready"] [data-sync-ready="true"][data-sync-content-hash]');
      if (!root || root.getBoundingClientRect().width === 0 || getComputedStyle(root).visibility !== "visible") return;
      const hash = root.dataset.syncContentHash!;
      if (proof.firstVisibleHashes.at(-1) !== hash) proof.firstVisibleHashes.push(hash);
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  return (envelope: PlayerManifestEnvelope, revision: number) => {
    const item: PlayerManifestItem = { ...envelope.manifest.items[0]!, id: "slow-first-main", kind: "composition", durationSeconds: 30,
      dynamicTemplate: undefined, source: { url: `${origin}/__s295-early-source.json`, mimeType: syncDomDescriptorMimeType,
        bytes: Buffer.byteLength(descriptor), checksumSha256: descriptorHash },
      syncDynamic: { schemaVersion: 2, configurationSnapshotId: uuid(301), snapshotId: uuid(301), templateVersionId: uuid(302),
        configurationHash: "c".repeat(64), descriptorChecksumSha256: descriptorHash, contentHash: String(revision).repeat(64),
        dataRevision: revision, durationMs: 30_000, presentation: presentation(revision), assets: {} } };
    envelope.manifest = { ...envelope.manifest, schemaVersion: 2, items: [item],
      syncSystemAssets: syncSlideRendererAssets(initial).map(asset => ({ path: asset.path, checksumSha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType })) };
    return envelope;
  };
}

test("an activation update prepared before the first main frame is visible in that same occurrence", async ({ page }) => {
  test.setTimeout(45_000);
  const transform = await delayedMainRenderer(page);
  const state = await setup(page, "browser", "news", false, false, 0, { transform, changeOnFirstActivation: true });
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { earlyMainProof: { loads: number } }).earlyMainProof.loads
  )).toBeGreaterThan(0);
  await expect.poll(() => state.requests.some(request => request.revision === 2 && request.status === 200 && Boolean(request.conditional))).toBe(true);
  await expect(page.locator(`[data-sync-content-hash="${"2".repeat(64)}"]`)).toBeAttached({ timeout: 3_000 });
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { earlyMainProof: { release(): void } }).earlyMainProof.release());
  await expect(page.getByText("Eerste hoofdframe 2", { exact: true })).toBeVisible();
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { earlyMainProof: { firstVisibleHashes: string[] } }).earlyMainProof.firstVisibleHashes
  )).toEqual(["2".repeat(64)]);
  const observed = state.requests.length;
  await page.waitForTimeout(350);
  expect(state.requests.length).toBe(observed);
  expect(observed).toBeLessThanOrEqual(3);
});

test("a visible side zone retains its boundary while the main first frame is still preparing", async ({ page }) => {
  test.setTimeout(45_000);
  const slowMain = await delayedMainRenderer(page);
  const state = await setup(page, "browser", "news", false, true, 0, { transform: envelope => slowMain(envelope, 1) });
  const side = page.getByText("Zichtbaar 1", { exact: true }).last();
  await expect(side).toBeVisible();
  await expect(side.locator('xpath=ancestor::*[@data-player-handoff]')).toHaveAttribute("data-player-handoff", "first-frame-ready");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { earlyMainProof: { loads: number } }).earlyMainProof.loads
  )).toBeGreaterThan(0);
  await expect(page.locator('[data-sync-ready="true"]')).toHaveCount(0);
  await side.evaluate(element => element.setAttribute("data-visible-before-main", "preserved"));
  state.setRevision(2);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.requests.some(request => request.revision === 2 && request.status === 200)).toBe(true);
  await expect(page.getByText("Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.", { exact: true })).toHaveCount(1);
  await page.waitForTimeout(350);
  await expect(side).toHaveAttribute("data-visible-before-main", "preserved");
  await expect(page.getByText("Zichtbaar 2", { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { earlyMainProof: { release(): void } }).earlyMainProof.release());
  await expect(page.getByText("Eerste hoofdframe 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 10_000 });
});

for (const platform of ["browser", "static-lg"] as const) {
  test(`${platform}: slow activation reads coalesce and a newer follow-up replaces their old facts`, async ({ page }) => {
    test.setTimeout(45_000);
    const state = await setup(page, platform);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    await expect.poll(() => state.requests.length).toBeGreaterThanOrEqual(2);
    state.holdNext();
    await expect.poll(() => state.held, { timeout: 7_000 }).toBe(true);
    const waiting = state.requests.length;
    state.setRevision(2);
    // Another real occurrence starts while the origin still owns the read.
    await page.waitForTimeout(5_300);
    expect(state.held).toBe(true);
    expect(state.requests.length).toBe(waiting);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    await state.releaseHeld();
    await expect.poll(() => state.requests.some(request => request.revision === 2), { timeout: 2_000 }).toBe(true);
    await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 7_000 });
    await page.waitForTimeout(350);
    await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible();
  });

  test(`${platform}: a failed origin preserves local playback and activation respects retry backoff until reconnect`, async ({ page }) => {
    test.setTimeout(45_000);
    const state = await setup(page, platform);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    await expect.poll(() => state.requests.length).toBeGreaterThanOrEqual(2);
    state.setOffline(true);
    await expect.poll(() => state.requests.some(request => request.status === 503), { timeout: 7_000 }).toBe(true);
    const failed = state.requests.length;
    await page.waitForTimeout(5_300);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    expect(state.requests.length).toBe(failed);
    state.setRevision(2);
    state.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => state.requests.some(request => request.revision === 2), { timeout: 2_000 }).toBe(true);
    await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 7_000 });
  });

  for (const family of ["news", "sport_results"] as const) test(`${platform}: each single-item ${family} occurrence checks conditionally and displays new facts at a natural boundary`, async ({ page }, info) => {
    test.setTimeout(45_000);
    const state = await setup(page, platform, family);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    await expect.poll(() => state.requests.filter(request => request.status === 304).length).toBeGreaterThan(0);
    if (platform === "browser") {
      await expect(page.getByText("Zichtbaar 1", { exact: true }).last().locator('xpath=ancestor::*[@data-player-handoff]')).toHaveAttribute("data-player-handoff", "first-frame-ready");
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    } else await expect(page.locator('#media-root > .visible:not(.retiring)').getByText("Zichtbaar 1", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("visible-before-frame.png") });
    await page.evaluate(() => { document.documentElement.dataset.activationProof = "preserved"; });
    const before = state.requests.length;
    const changedAt = Date.now();
    state.setRevision(2);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    // A full item is five seconds; the first check follows its own activation,
    // while the verified current frame stays visible until the next boundary.
    // Complete new facts may then win that next occurrence's first frame.
    await expect.poll(() => state.requests.some(request => request.revision === 2 && request.status === 200), { timeout: 7_000 }).toBe(true);
    await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 7_000 });
    if (platform === "browser") {
      await expect(page.getByText("Zichtbaar 2", { exact: true }).last().locator('xpath=ancestor::*[@data-player-handoff]')).toHaveAttribute("data-player-handoff", "first-frame-ready");
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    } else await expect(page.locator('#media-root > .visible:not(.retiring)').getByText("Zichtbaar 2", { exact: true })).toBeVisible();
    const after = state.requests.length;
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThanOrEqual(3);
    await page.waitForTimeout(350);
    expect(state.requests.length).toBe(after);
    expect(await page.evaluate(() => document.documentElement.dataset.activationProof)).toBe("preserved");
    expect(state.requests.slice(1).every(request => Boolean(request.conditional))).toBe(true);
    await writeFile(info.outputPath("activation-evidence.json"), JSON.stringify({ fixture: true, platform, family, verifiedFrame: true, periodicIntervalMs: 60_000, itemDurationMs: 5_000, immutableReleaseId: uuid(1), requests: state.requests, originChangeToVisibleFrameMs: Date.now() - changedAt, visibleRevision: 2 }));
    await page.screenshot({ path: info.outputPath("visible-updated-frame.png") });
  });

  test(`${platform}: a stale legacy 200 preserves newer prepared news and a higher revision can correct it back to earlier facts`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.clock.install();
    const state = await setup(page, platform, "news", false, false, 0, { transform: (envelope, revision) => {
      const item = envelope.manifest.items[0]!, payload = item.dynamicTemplate!;
      if (revision === 3) {
        payload.snapshotHash = "1".repeat(64);
        (payload.data.news as { articles: Array<{ title: string }> }).articles[0]!.title = "Zichtbaar 1";
      }
      item.dynamicData = { schemaVersion: 1, configurationSnapshotId: payload.snapshotId, snapshotId: payload.snapshotId,
        templateVersionId: payload.templateVersionId, configurationHash: "c".repeat(64), contentHash: payload.snapshotHash, dataRevision: revision };
      return envelope;
    } });
    const active = platform === "static-lg" ? page.locator('#media-root > .visible:not(.retiring)') : page.locator('[data-player-handoff="first-frame-ready"]');
    await expect(active.getByText("Zichtbaar 1", { exact: true })).toBeVisible();
    await expect.poll(() => state.requests.some(request => request.status === 304)).toBe(true);
    await page.clock.pauseAt(new Date(Date.now() + 100));
    const storedRevision = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("veyocast-player-cache-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, read = db.transaction("activeReleases").objectStore("activeReleases").get("a".repeat(48));
        read.onsuccess = () => { db.close(); resolve(read.result?.envelope.manifest.items[0]?.dynamicData?.dataRevision ?? 0); };
      };
    }));
    const staged = async () => {
      if (platform === "browser") await expect(page.getByText("Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.", { exact: true })).toHaveCount(1);
      else await expect.poll(() => state.heartbeats.some(body => body.syncPhase === "switch_pending")).toBe(true);
    };
    state.heartbeats.length = 0;
    state.setRevision(2);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    // LG schedules its authorized read on a zero-delay timer.
    await page.clock.runFor(1);
    await staged();
    await expect(active.getByText("Zichtbaar 1", { exact: true })).toBeVisible();
    state.setRevision(1);
    const beforeStale = state.requests.length;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    // LG schedules its authorized read on a zero-delay timer.
    await page.clock.runFor(1);
    await expect.poll(() => state.requests.length).toBeGreaterThan(beforeStale);
    await page.waitForTimeout(100);
    await page.clock.fastForward(5_500);
    // Persistence and asset lookup are asynchronous. Advance the frozen rAF
    // clock only after the candidate has actually been installed in the DOM.
    await expect.poll(storedRevision).toBe(2);
    await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeAttached();
    await page.clock.runFor(700);
    await expect(active.getByText("Zichtbaar 2", { exact: true })).toBeVisible();
    await page.clock.runFor(100);
    // This is a real higher-revision correction, even though its fact hash
    // equals the first frame. A hash blacklist would incorrectly reject it.
    state.heartbeats.length = 0;
    state.setRevision(3);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    // LG schedules its authorized read on a zero-delay timer.
    await page.clock.runFor(1);
    await expect.poll(() => state.requests.some(request => request.revision === 3 && request.status === 200)).toBe(true);
    await staged();
    await page.clock.fastForward(5_500);
    await expect.poll(storedRevision).toBe(3);
    await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeAttached();
    await page.clock.runFor(700);
    await expect(active.getByText("Zichtbaar 1", { exact: true })).toBeVisible();
    expect(state.requests.slice(1).every(request => Boolean(request.conditional))).toBe(true);
  });

  test(`${platform}: ordinary results display zero-zero, correct the same match and apply removal and valid empty facts`, async ({ page, context }, info) => {
    test.setTimeout(75_000);
    const state = await setup(page, platform, "sport_results", false, false, 0, { transform: (envelope, revision) => {
      const item = envelope.manifest.items[0]!, payload = item.dynamicTemplate!;
      const oldResult = { id: "match-old", primary: "Oude thuisploeg – Oude bezoekers", homeTeam: "Oude thuisploeg", awayTeam: "Oude bezoekers", status: "finished", homeScore: 1, awayScore: 1 };
      const newResult = { id: "match-new", primary: "Nieuwe thuisploeg – Nieuwe bezoekers", homeTeam: "Nieuwe thuisploeg", awayTeam: "Nieuwe bezoekers", status: "finished", homeScore: revision >= 3 ? 2 : 0, awayScore: 0 };
      const sport = payload.data.sport as { items: unknown[]; emptyStateCode?: string };
      sport.items = revision === 1 ? [oldResult] : revision < 4 ? [newResult, oldResult] : revision === 4 || revision === 6 ? [newResult] : [];
      sport.emptyStateCode = "NO_ITEMS_IN_PERIOD";
      item.dynamicData = { schemaVersion: 1, configurationSnapshotId: payload.snapshotId, snapshotId: payload.snapshotId,
        templateVersionId: payload.templateVersionId, configurationHash: "c".repeat(64), contentHash: payload.snapshotHash, dataRevision: revision };
      return envelope;
    } });
    const active = platform === "static-lg" ? page.locator('#media-root > .visible:not(.retiring)') : page.locator('[data-player-handoff="first-frame-ready"]');
    const cached = () => page.evaluate(() => new Promise<{ revision: number; releaseId: string; ids: string[] }>((resolve, reject) => {
      const request = indexedDB.open("veyocast-player-cache-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, read = db.transaction("activeReleases").objectStore("activeReleases").get("a".repeat(48));
        read.onsuccess = () => { const manifest = read.result?.envelope.manifest, item = manifest?.items[0]; db.close();
          resolve({ revision: item?.dynamicData?.dataRevision ?? 0, releaseId: manifest?.releaseId ?? "", ids: item?.dynamicTemplate?.data.sport.items.map((row: { id: string }) => row.id) ?? [] }); };
      };
    }));
    const frames: Array<{ revision: number; matchIds: string[]; verifiedFrame: boolean; score: string | null; emptyState?: string }> = [];
    await expect(active.getByText("Oude thuisploeg", { exact: true })).toBeVisible();
    await expect(active.getByLabel("Uitslag 1 tegen 1", { exact: true })).toHaveText("1–1");
    await expect.poll(() => state.requests.some(request => request.status === 304)).toBe(true);
    for (const revision of [2, 3, 4, 5]) {
      const before = state.requests.length;
      if (platform === "static-lg" && revision === 5) await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put, fault = { blocked: true, attempts: 0 };
        Object.assign(window, { emptyPersistFault: fault });
        IDBObjectStore.prototype.put = function (value, ...args) {
          if (this.name === "activeReleases" && fault.blocked && value?.envelope?.manifest?.items?.[0]?.dynamicData?.dataRevision === 5) {
            fault.attempts++; throw new DOMException("Synthetic accepted-empty persistence failure", "QuotaExceededError");
          }
          return original.call(this, value, ...args);
        };
      });
      state.setRevision(revision);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect.poll(() => state.requests.some(request => request.revision === revision && request.status === 200)).toBe(true);
      if (platform === "static-lg" && revision === 5) {
        await expect.poll(() => page.evaluate(() => (window as unknown as { emptyPersistFault: { attempts: number } }).emptyPersistFault.attempts), { timeout: 7_000 }).toBeGreaterThan(0);
        expect((await cached()).revision).toBe(4);
        await expect(active.getByText("Nieuwe thuisploeg", { exact: true })).toBeVisible();
        await expect(active.getByLabel("Uitslag 2 tegen 0", { exact: true })).toBeVisible();
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => (window as unknown as { emptyPersistFault: { attempts: number } }).emptyPersistFault.attempts)).toBeLessThanOrEqual(2);
        await page.evaluate(() => { (window as unknown as { emptyPersistFault: { blocked: boolean } }).emptyPersistFault.blocked = false; });
      }
      await expect.poll(async () => (await cached()).revision, { timeout: 7_000 }).toBe(revision);
      const score = revision === 2 ? "0–0" : revision < 5 ? "2–0" : null;
      if (score !== null) {
        await expect(active.getByText("Nieuwe thuisploeg", { exact: true })).toBeVisible({ timeout: 7_000 });
        await expect(active.getByLabel(`Uitslag ${revision === 2 ? 0 : 2} tegen 0`, { exact: true })).toBeVisible();
        await expect(active.getByLabel(`Uitslag ${revision === 2 ? 0 : 2} tegen 0`, { exact: true })).toHaveText(score);
      } else {
        // Historical results deliberately skip an ineligible empty item.
        // A single empty item therefore uses the existing connected/ready UI.
        await expect(page.getByText("Dit scherm wacht op jouw verhaal.", { exact: true })).toBeVisible({ timeout: 7_000 });
        await expect(page.getByText("Nieuwe thuisploeg", { exact: true })).toHaveCount(0);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      }
      await expect(active.getByText("Oude thuisploeg", { exact: true })).toHaveCount(revision < 4 ? 1 : 0);
      if (platform === "static-lg" && revision < 5) await expect.poll(() => active.evaluate(element =>
        (element as HTMLElement & { lgSourceDataIdentity?: string }).lgSourceDataIdentity ?? ""
      )).toContain(`dynamic-data-v1:${String(revision).repeat(64)}:${revision}:`);
      if (revision < 5) await expect.poll(() => state.requests.some(request => request.revision === revision && request.status === 304)).toBe(true);
      const installed = await cached();
      expect(installed.releaseId).toBe(uuid(1));
      expect(installed.ids).toEqual(revision < 4 ? ["match-new", "match-old"] : revision === 4 ? ["match-new"] : []);
      expect(state.requests.length - before).toBeLessThanOrEqual(3);
      const checked = state.requests.length;
      await page.waitForTimeout(200);
      expect(state.requests.length).toBe(checked);
      frames.push({ revision, matchIds: installed.ids, verifiedFrame: true, score, ...(revision === 5 ? { emptyState: "connected-ready-existing-skip-contract" } : {}) });
      await page.screenshot({ path: info.outputPath(`results-revision-${revision}-frame.png`) });
    }
    expect(state.authorized).toBe(true);
    expect(state.requests.slice(1).every(request => Boolean(request.conditional))).toBe(true);
    state.setOffline(true);
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByText("Dit scherm wacht op jouw verhaal.", { exact: true })).toBeVisible();
      expect(await cached()).toEqual({ revision: 5, releaseId: uuid(1), ids: [] });
      await expect(page.getByText("Nieuwe thuisploeg", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Oude thuisploeg", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("veyocast.player.deviceToken"))).toBe("a".repeat(48));
      await page.screenshot({ path: info.outputPath("results-empty-offline-frame.png") });
    } finally { await context.setOffline(false); }
    state.setOffline(false); state.setRevision(6); await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await cached()).revision, { timeout: 7_000 }).toBe(6);
    await expect(active.getByText("Nieuwe thuisploeg", { exact: true })).toBeVisible();
    await expect(active.getByLabel("Uitslag 2 tegen 0", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("results-restored-after-empty-frame.png") });
    await writeFile(info.outputPath("results-acceptance-evidence.json"), JSON.stringify({ fixture: true, platform, immutableReleaseId: uuid(1), periodicIntervalMs: 60_000, itemDurationMs: 5_000, sameCorrectedMatchId: "match-new", emptyOfflineReloadRetained: true, freshAfterEmptyRevision: 6, frames, requests: state.requests }));
  });

  test(`${platform}: independently empty side and main zones retain other clocks, recover fresh facts and survive offline`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    await page.clock.install();
    const state = await setup(page, platform, "sport_results", false, true, 0, { transform: (envelope, revision) => {
      const base = envelope.manifest.items[0]!, mainRevision = revision < 4 ? 1 : revision === 4 ? 2 : 3;
      const main = dynamicItem(base, "news", "Hoofdinhoud", mainRevision === 2 ? 2 : 1);
      main.id = "unchanged-main"; main.durationSeconds = 120;
      (main.dynamicTemplate!.data.news as { secondsPerSlide: number }).secondsPerSlide = 120;
      main.dynamicTemplate!.snapshotId = uuid(40); main.dynamicTemplate!.templateVersionId = uuid(41);
      if (mainRevision === 2) (main.dynamicTemplate!.data.news as { articles: unknown[] }).articles = [];
      main.dynamicData = { schemaVersion: 1, configurationSnapshotId: uuid(40), snapshotId: uuid(40), templateVersionId: uuid(41), configurationHash: "d".repeat(64), contentHash: main.dynamicTemplate!.snapshotHash, dataRevision: mainRevision };
      envelope.manifest.items = [main];
      const side = envelope.composition!.zones.side!.manifest.items[0]!, sideRevision = Math.min(3, revision), payload = side.dynamicTemplate!;
      payload.snapshotHash = String(sideRevision).repeat(64);
      (payload.data.sport as { items: unknown[] }).items = sideRevision === 2 ? [] : [{ id: "side-match", primary: "Zijploeg – Bezoekers", homeTeam: "Zijploeg", awayTeam: "Bezoekers", status: "finished", homeScore: sideRevision, awayScore: 0 }];
      side.durationSeconds = 19;
      side.dynamicData = { schemaVersion: 1, configurationSnapshotId: payload.snapshotId, snapshotId: payload.snapshotId, templateVersionId: payload.templateVersionId, configurationHash: "c".repeat(64), contentHash: payload.snapshotHash, dataRevision: sideRevision };
      const bottom = envelope.composition!.zones.bottom!.manifest.items[0]!.dynamicTemplate!;
      bottom.snapshotHash = "1".repeat(64); (bottom.data.sport as { items: Array<{ homeScore: number }> }).items[0]!.homeScore = 1;
      return envelope;
    } });
    const mainZone = platform === "static-lg" ? page.frameLocator('.lg-screen-composition.visible:not(.retiring) iframe[data-lg-composition-zone="main"]') : page;
    const sideZone = zone(page, platform, "side");
    const mainHeading = mainZone.getByText("Hoofdinhoud", { exact: true });
    const sideFrame = platform === "static-lg" ? sideZone.locator('#media-root > .visible:not(.retiring)') : sideZone.locator('[data-player-handoff="first-frame-ready"]').filter({ has: page.getByText("Zijploeg", { exact: true }) });
    const read = () => page.evaluate(() => new Promise<{ main: number; side: number; release: string }>((resolve, reject) => {
      const request = indexedDB.open("veyocast-player-cache-v1"); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, query = db.transaction("activeReleases").objectStore("activeReleases").get("a".repeat(48));
        query.onsuccess = () => { const envelope = query.result?.envelope; db.close(); resolve({ main: envelope?.manifest.items[0]?.dynamicData?.dataRevision ?? 0, side: envelope?.composition?.zones.side?.manifest.items[0]?.dynamicData?.dataRevision ?? 0, release: envelope?.manifest.releaseId ?? "" }); }; };
    }));
    const pause = async () => page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
    const prepare = async (revision: number) => {
      state.heartbeats.length = 0; state.setRevision(revision);
      await page.evaluate(() => window.dispatchEvent(new Event("online"))); await page.clock.runFor(1);
      await expect.poll(() => state.requests.some(request => request.revision === revision && request.status === 200)).toBe(true);
      if (platform === "browser") await expect(page.getByText("Nieuwe brongegevens volledig gecontroleerd; wisselen na de huidige slide.", { exact: true })).toHaveCount(1);
      else await expect.poll(() => state.heartbeats.some(body => body.syncPhase === "switch_pending")).toBe(true);
    };
    const emptyFrame = async (id: "main" | "side") => {
      if (platform === "browser") {
        const empty = page.locator(id === "main" ? '[data-player-empty-zone^="main:"]' : '[data-player-empty-zone]:not([data-player-empty-zone^="main:"])');
        await expect(empty.getByRole("heading", { name: "Geen gegevens", exact: true })).toBeVisible({ timeout: 12_000 });
        await expect(empty).toHaveAttribute("data-player-handoff", "first-frame-ready");
      } else {
        const frame = id === "main" ? mainZone : sideZone;
        await expect(frame.getByText("Dit scherm wacht op jouw verhaal.", { exact: true })).toBeVisible({ timeout: 12_000 });
        const marker = `dynamic-data-v1:${"2".repeat(64)}:2:`;
        await expect.poll(() => page.locator('.lg-screen-composition.visible:not(.retiring)').evaluate(element => (element as HTMLElement & { lgSourceDataIdentity?: string }).lgSourceDataIdentity ?? "")).toContain(marker);
      }
    };
    await expect(mainHeading).toBeVisible(); await expect(sideFrame.getByLabel("Uitslag 1 tegen 0", { exact: true })).toBeVisible();
    await expect.poll(() => state.requests.some(request => request.status === 304)).toBe(true);
    await mainHeading.evaluate(element => element.setAttribute("data-main-instance", "preserved"));
    await pause(); await prepare(2); await page.clock.fastForward(19_500); await page.clock.resume();
    await expect.poll(async () => (await read()).side, { timeout: 12_000 }).toBe(2); await emptyFrame("side");
    await expect(mainHeading).toHaveAttribute("data-main-instance", "preserved"); await expect(sideZone.getByText("Zijploeg", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("side-empty-main-preserved-frame.png") });
    if (platform === "browser") await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true })); });
    state.setOffline(true); await context.setOffline(true);
    try { await page.reload(); await emptyFrame("side"); await expect(mainHeading).toBeVisible(); expect(await read()).toEqual({ main: 1, side: 2, release: uuid(1) }); await expect(sideZone.getByText("Zijploeg", { exact: true })).toHaveCount(0); }
    finally { state.setOffline(false); await context.setOffline(false); }
    const mainReadyClock = await page.evaluate(() => performance.now());
    await mainHeading.evaluate(element => element.setAttribute("data-main-instance", "preserved-after-offline"));
    await pause(); await prepare(3); await page.clock.fastForward(19_500); await page.clock.resume();
    await expect.poll(async () => (await read()).side, { timeout: 12_000 }).toBe(3); await expect(sideFrame.getByLabel("Uitslag 3 tegen 0", { exact: true })).toBeVisible();
    await expect(mainHeading).toHaveAttribute("data-main-instance", "preserved-after-offline");
    await pause(); await prepare(4);
    // Move near the actual 120s main boundary, then mark the independently
    // running 19s side occurrence. Its next own end remains well after this
    // main-only update; an accidental compositor restart loses this marker.
    await page.clock.fastForward(Math.max(1, 115_000 - (await page.evaluate(() => performance.now()) - mainReadyClock))); await page.clock.resume();
    await expect(mainHeading).toHaveAttribute("data-main-instance", "preserved-after-offline");
    // A large clock jump starts the side's own next turn. Wait for its actual
    // verified replacement before marking it; the preceding visible frame may
    // already be the outgoing cut while that renderer is still preparing.
    await expect(sideZone.locator(platform === "browser" ? '[data-player-transition-outgoing]' : '#media-root > .retiring')).toHaveCount(0);
    await expect(sideFrame.getByLabel("Uitslag 3 tegen 0", { exact: true })).toBeVisible();
    await sideFrame.evaluate(element => element.setAttribute("data-side-instance", "preserved"));
    const originalSideClock = await page.evaluate(() => performance.now());
    await pause(); await page.clock.fastForward(6_000); await page.clock.resume();
    await expect.poll(async () => (await read()).main, { timeout: 12_000 }).toBe(2); await emptyFrame("main");
    await expect(sideFrame).toHaveAttribute("data-side-instance", "preserved"); await expect(sideFrame.getByLabel("Uitslag 3 tegen 0", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("main-empty-side-preserved-frame.png") });
    await pause(); await prepare(5); await page.clock.fastForward(5_500); await page.clock.resume();
    await expect.poll(async () => (await read()).main, { timeout: 12_000 }).toBe(3); await expect(mainHeading).toBeVisible(); await expect(sideFrame).toHaveAttribute("data-side-instance", "preserved");
    expect(await read()).toEqual({ main: 3, side: 3, release: uuid(1) });
    await page.screenshot({ path: info.outputPath("both-zones-recovered-frame.png") });
    await pause(); await page.clock.fastForward(Math.max(1, 19_100 - (await page.evaluate(() => performance.now()) - originalSideClock))); await page.clock.resume();
    await expect(sideFrame).not.toHaveAttribute("data-side-instance", "preserved");
    const observedSideClockMs = await page.evaluate(() => performance.now()) - originalSideClock;
    expect(observedSideClockMs).toBeLessThan(20_000);
    await writeFile(info.outputPath("empty-zone-evidence.json"), JSON.stringify({ fixture: true, platform, immutableMainReleaseId: uuid(1), mainDurationMs: 120_000, sideDurationMs: 19_000, observedSideClockMs, sideEmptyOfflineReload: true, mainRetainedDuringSideChanges: true, sideRetainedDuringMainChanges: true, restored: await read(), requests: state.requests }));
  });

  test(`${platform}: repeated slide IDs start distinct occurrences without a redraw request loop`, async ({ page }) => {
    const state = await setup(page, platform, "news", true);
    const active = platform === "static-lg" ? page.locator('#media-root > .visible:not(.retiring)') : page.locator('[data-player-handoff="first-frame-ready"]');
    await expect(active.getByText("Herhaalde A", { exact: true })).toBeVisible();
    await expect.poll(() => state.requests.length).toBeGreaterThanOrEqual(2);
    const first = state.requests.length;
    await expect(active.getByText("Herhaalde B", { exact: true })).toBeVisible({ timeout: 7_000 });
    await expect.poll(() => state.requests.length).toBeGreaterThan(first);
    const second = state.requests.length;
    await expect(active.getByText("Herhaalde A", { exact: true })).toBeVisible({ timeout: 7_000 });
    await expect.poll(() => state.requests.length).toBeGreaterThan(second);
    expect(state.requests.slice(1).every(request => request.status === 304)).toBe(true);
    expect(state.requests.length).toBeLessThanOrEqual(5);
  });

  test(`${platform}: two independent dynamic zones share the authorized check while the main item keeps playing`, async ({ page }) => {
    test.setTimeout(45_000);
    const state = await setup(page, platform, "news", false, true);
    await expect(zone(page, platform, "side").getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
    await expect(zone(page, platform, "bottom").getByText("Poulewedstrijd", { exact: true }).last()).toBeVisible();
    const main = platform === "static-lg" ? page.frameLocator('iframe[data-lg-composition-zone="main"]').getByRole("img", { name: "Hoofdzone blijft spelen", exact: true }) : page.getByRole("img", { name: "Hoofdzone blijft spelen", exact: true });
    await main.evaluate(element => element.setAttribute("data-original-main", "preserved"));
    const initial = state.requests.length;
    state.setRevision(2);
    await expect.poll(() => state.requests.some(request => request.revision === 2), { timeout: 7_000 }).toBe(true);
    await expect(zone(page, platform, "side").getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 9_000 });
    await expect(main).toHaveAttribute("data-original-main", "preserved");
    expect(state.requests.length - initial).toBeLessThanOrEqual(5);
    expect(state.requests.slice(1).every(request => Boolean(request.conditional))).toBe(true);
  });
}

test("a rejected side-zone data commit preserves the main occurrence and resumes verified playback", async ({ page }) => {
  test.setTimeout(45_000);
  const state = await setup(page, "browser", "news", false, true);
  const main = page.getByRole("img", { name: "Hoofdzone blijft spelen", exact: true });
  await expect(main).toBeVisible();
  await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
  await expect.poll(() => state.requests.length).toBeGreaterThanOrEqual(2);
  await main.evaluate(element => element.setAttribute("data-main-before-quota", "preserved"));
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    const fault = { blocked: true, rejected: 0 };
    Object.assign(window, { zoneCommitFault: fault });
    IDBObjectStore.prototype.put = function (value, ...args) {
      const side = value?.envelope?.composition?.zones?.side;
      if (this.name === "activeReleases" && fault.blocked &&
          side?.manifest?.items?.[0]?.dynamicTemplate?.snapshotHash === "2".repeat(64)) {
        fault.rejected++;
        throw new DOMException("Synthetic activation storage failure", "QuotaExceededError");
      }
      return originalPut.call(this, value, ...args);
    };
  });
  state.setRevision(2);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { zoneCommitFault: { rejected: number } }).zoneCommitFault.rejected
  ), { timeout: 16_000 }).toBeGreaterThan(0);
  await expect(main).toHaveAttribute("data-main-before-quota", "preserved");
  await expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Zichtbaar 2", { exact: true })).toHaveCount(0);
  // Resuming a held zone must not report its same boundary again and create a
  // tight persistence retry loop while the verified old frame stays on screen.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() =>
    (window as unknown as { zoneCommitFault: { rejected: number } }).zoneCommitFault.rejected
  )).toBeLessThanOrEqual(2);
  await expect(main).toHaveAttribute("data-main-before-quota", "preserved");
  await page.evaluate(() => {
    (window as unknown as { zoneCommitFault: { blocked: boolean } }).zoneCommitFault.blocked = false;
  });
  await expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 12_000 });
  await expect(main).toHaveAttribute("data-main-before-quota", "preserved");
  expect(state.authorized).toBe(true);
});

test("concurrent screens retain separate authorized playback and activation checks", async ({ browser }) => {
  test.setTimeout(45_000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const states = await Promise.all(pages.map((page, index) => setup(page, "browser", "news", false, false, index)));
    await Promise.all(pages.map(page => expect(page.getByText("Zichtbaar 1", { exact: true }).last()).toBeVisible()));
    states.forEach(state => state.setRevision(2));
    await Promise.all(pages.map(page => expect(page.getByText("Zichtbaar 2", { exact: true }).last()).toBeVisible({ timeout: 14_000 })));
    expect(states.every(state => state.authorized && state.requests.some(request => request.status === 304))).toBe(true);
    expect(states.every(state => state.requests.length <= 6)).toBe(true);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
