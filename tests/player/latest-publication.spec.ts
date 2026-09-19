import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

for (const platform of ["browser", "static-lg"] as const) {
  for (const scenario of ["newer-target", "crash"] as const) {
    test(`${platform}: ${scenario} during the activation transaction preserves a complete latest state`, async ({ page }) => {
      const baseline = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
      const release = (revision: number): PlayerManifestEnvelope => ({ ...baseline,
        device: { ...baseline.device, desiredReleaseId: `atomic-${revision}` },
        target: { revision: String(revision), configRevision: String(revision), publicationId: baseline.manifest.playlistId,
          assignmentSource: "default", committedAt: new Date().toISOString() },
        manifest: { ...baseline.manifest, releaseId: `atomic-${revision}`, items: [{ ...baseline.manifest.items[0]!,
          id: `atomic-item-${revision}`, sourceItemId: "atomic-item", contentHash: String(revision), durationSeconds: 2,
          accessibilityName: `Atomic ${revision}`, title: `Atomic ${revision}` }] }
      });
      let desired = release(1);
      let held = false;
      const shown: string[] = [];
      const received: string[] = [];
      await page.exposeFunction("activationCommitHeld", () => { held = true; });
      await page.addInitScript(() => {
        localStorage.setItem("veyocast.player.deviceToken", "a".repeat(48));
        localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
        const marked = new WeakSet<IDBTransaction>();
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, ...args) {
          if (this.name === "activeReleases" && value?.envelope?.manifest?.releaseId === "atomic-2") marked.add(this.transaction);
          return originalPut.call(this, value, ...args);
        };
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, "oncomplete")!;
        Object.defineProperty(IDBTransaction.prototype, "oncomplete", { ...descriptor,
          set(handler) {
            descriptor.set!.call(this, function (this: IDBTransaction, event: Event) {
              if (!marked.has(this)) return handler?.call(this, event);
              // The real atomic commit completed. Delay only its callback, as a
              // suspended renderer would, while network invalidation continues.
              Object.assign(window, { finishHeldActivation: () => handler?.call(this, event) });
              void (window as unknown as { activationCommitHeld(): Promise<void> }).activationCommitHeld();
            });
          }
        });
      });
      await page.route("**/api/player/installation", (route) => route.fulfill({ json: { ok: true, bound: true, installationCredential: "i".repeat(48) } }));
      await page.route("**/api/player/realtime", (route) => route.fulfill({ status: 204 }));
      await page.route("**/api/player/manifest*", (route) => route.fulfill({ json: desired }));
      await page.route("**/api/player/heartbeat", (route) => {
        const body = route.request().postDataJSON();
        if (body.activeReleaseId) shown.push(body.activeReleaseId);
        if (body.desiredReleaseId) received.push(body.desiredReleaseId);
        return route.fulfill({ json: { ok: true } });
      });
      await page.goto(platform === "browser" ? `${playerURL}/?syncMs=250` : `${playerURL}/lg/legacy`);
      await expect.poll(() => shown.includes("atomic-1")).toBe(true);
      desired = release(2);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect.poll(() => held, { timeout: 10_000 }).toBe(true);
      if (scenario === "crash") {
        await page.route("**/api/player/manifest*", (route) => route.abort());
        await page.route("**/player-demo/**", (route) => route.abort());
        await page.reload();
        await expect(page.getByRole("img", { name: "Atomic 2", exact: true })).toBeVisible();
      } else {
        desired = release(3);
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await expect.poll(() => received.includes("atomic-3")).toBe(true);
        await page.evaluate(() => (window as unknown as { finishHeldActivation(): void }).finishHeldActivation());
        await expect.poll(() => shown.includes("atomic-3"), { timeout: 10_000 }).toBe(true);
        expect(shown).not.toContain("atomic-2");
        await expect(page.getByRole("img", { name: "Atomic 3", exact: true })).toBeVisible();
      }
    });
  }
}

for (const platform of ["browser", "static-lg"] as const) {
  test(`${platform}: ten pending publications replace each other and switch at the first item boundary`, async ({ page }, testInfo) => {
    const response = await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`);
    const baseline = await response.json() as PlayerManifestEnvelope;
    const token = "d".repeat(48);
    const release = (revision: number): PlayerManifestEnvelope => ({ ...baseline,
      device: { ...baseline.device, desiredReleaseId: `publication-${revision}` },
      target: { revision: String(revision), configRevision: String(revision), publicationId: baseline.manifest.playlistId,
        assignmentSource: "default", committedAt: new Date().toISOString() },
      manifest: { ...baseline.manifest, releaseId: `publication-${revision}`, label: `Publication ${revision}`,
        items: Array.from({ length: 25 }, (_, index) => ({ ...baseline.manifest.items[0]!,
          id: `revision-${revision}-item-${index}`, sourceItemId: `stable-${index}`,
          contentHash: index === 20 ? `changed-${revision}` : `same-${index}`,
          durationSeconds: 5, title: `Publication ${revision} item ${index}`,
          accessibilityName: `Publication ${revision} item ${index}` })) }
    });
    let desired = release(1);
    let requests = 0;
    const shown: string[] = [];
    const traces: Array<Record<string, unknown>> = [];
    await page.addInitScript((deviceToken) => {
      localStorage.setItem("veyocast.player.deviceToken", deviceToken);
      localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
    }, token);
    await page.route("**/api/player/installation", (route) => route.fulfill({ json: {
      ok: true, bound: true, installationCredential: "i".repeat(48)
    } }));
    await page.route("**/api/player/realtime", (route) => route.fulfill({ status: 204 }));
    await page.route("**/api/player/manifest*", (route) => { requests += 1; return route.fulfill({ json: desired }); });
    await page.route("**/api/player/heartbeat", (route) => {
      const body = route.request().postDataJSON() as { activeReleaseId?: string; publicationTrace?: Record<string, unknown> };
      if (body.activeReleaseId) shown.push(body.activeReleaseId);
      if (body.publicationTrace?.firstFrameAt) traces.push(body.publicationTrace);
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(platform === "browser" ? `${playerURL}/?durationMs=5000&syncMs=250` : `${playerURL}/lg/legacy`);
    await expect.poll(() => shown.includes("publication-1")).toBe(true);
    for (let revision = 2; revision <= 11; revision += 1) {
      const before = requests;
      desired = release(revision);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect.poll(() => requests).toBeGreaterThan(before);
    }
    await expect.poll(() => shown.includes("publication-11"), { timeout: 10_000 }).toBe(true);
    expect(shown.filter((id) => id !== "publication-1" && id !== "publication-11")).toEqual([]);
    await expect(page.getByRole("img", { name: "Publication 11 item 20", exact: true })).toBeVisible();
    const trace = traces.findLast((entry) => entry.releaseId === "publication-11");
    expect(trace).toMatchObject({ configRevision: "11", targetRevision: "11" });
    expect(typeof trace?.frameAfterBoundaryMs).toBe("number");
    const timingPath = testInfo.outputPath(`publication-timing-${platform}.json`);
    await writeFile(timingPath, JSON.stringify(trace, null, 2));
    await testInfo.attach(`publication-timing-${platform}`, { path: timingPath, contentType: "application/json" });
  });
}

for (const platform of ["browser", "static-lg"] as const) {
  test(`${platform}: a late obsolete download cannot replace the ready newest target`, async ({ page }) => {
    const { createHash } = await import("node:crypto");
    const baseline = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
    const releases = [1, 2, 4].map((revision) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${revision === 2 ? "red" : "blue"}"/><text x="10" y="30">${revision}</text></svg>`;
      const envelope: PlayerManifestEnvelope = { ...baseline, target: { revision: String(revision), configRevision: revision === 4 ? "1" : "100", publicationId: revision === 4 ? "other-playlist" : baseline.manifest.playlistId, assignmentSource: "default", committedAt: new Date().toISOString() },
        device: { ...baseline.device, desiredReleaseId: `late-${revision}` },
        manifest: { ...baseline.manifest, releaseId: `late-${revision}`, playlistId: revision === 4 ? "other-playlist" : baseline.manifest.playlistId,
          items: [{ ...baseline.manifest.items[0]!, id: `item-${revision}`, sourceItemId: "stable-item", contentHash: String(revision), title: `Target ${revision}`, accessibilityName: `Target ${revision}`, durationSeconds: 5,
            source: revision === 1 ? baseline.manifest.items[0]!.source : { ...baseline.manifest.items[0]!.source, url: `${playerURL}/s185-${revision}.svg`, bytes: Buffer.byteLength(svg), checksumSha256: createHash("sha256").update(svg).digest("hex") } }] } };
      return { envelope, svg };
    });
    let current = releases[0]!.envelope;
    let delayed: (() => Promise<void>) | undefined;
    const shown: string[] = [];
    await page.route("**/s185-2.svg", (route) => { delayed = () => route.fulfill({ body: releases[1]!.svg, contentType: "image/svg+xml" }).catch(() => undefined); });
    await page.route("**/s185-4.svg", (route) => route.fulfill({ body: releases[2]!.svg, contentType: "image/svg+xml" }));
    await page.route("**/api/player/manifest*", (route) => route.fulfill({ json: current }));
    await page.route("**/api/player/installation", (route) => route.fulfill({ json: { ok: true, bound: true, installationCredential: "i".repeat(48) } }));
    await page.route("**/api/player/realtime", (route) => route.fulfill({ status: 204 }));
    await page.route("**/api/player/heartbeat", (route) => {
      const id = route.request().postDataJSON().activeReleaseId;
      if (id) shown.push(id);
      return route.fulfill({ json: { ok: true } });
    });
    await page.addInitScript(() => { localStorage.setItem("veyocast.player.deviceToken", "c".repeat(48)); localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48)); });
    await page.goto(`${playerURL}/${platform === "static-lg" ? "lg/legacy" : "?syncMs=250"}`);
    await expect(page.getByRole("img", { name: "Target 1", exact: true })).toBeVisible();
    current = releases[1]!.envelope;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => Boolean(delayed)).toBe(true);
    current = releases[2]!.envelope;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("img", { name: "Target 4", exact: true })).toBeVisible({ timeout: 10_000 });
    await delayed!();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => shown.includes("late-4")).toBe(true);
    expect(shown).not.toContain("late-2");
    await expect(page.getByRole("img", { name: "Target 4", exact: true })).toBeVisible();
  });

  test(`${platform}: live results update the existing slide without publication or remount`, async ({ page }) => {
    const { incidentPayload, playIncidentPayload } = await import("./celebrations-layout-fixture");
    await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
    const payload = incidentPayload("sport_results", "landscape");
    const sport = payload.data.sport as { items: Array<Record<string, unknown>> };
    sport.items = [{ ...sport.items[0], id: "live-result", kickoffAt: "2026-09-09T10:00:00Z", homeTeam: "Live thuisploeg", awayTeam: "Live tegenstander", homeScore: 1, awayScore: 0, status: "Gespeeld" }];
    await playIncidentPayload(page, payload, platform === "static-lg", 60);
    const slide = page.locator('[data-slide-type="sport_results"]');
    await expect(slide.getByText("Live thuisploeg", { exact: true })).toBeVisible();
    await slide.evaluate((element) => element.setAttribute("data-original-dom", "preserved"));
    const envelope = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
    const image = envelope.manifest.items[0]!;
    sport.items[0]!.homeTeam = "Actuele thuisploeg";
    payload.snapshotHash = "d".repeat(64);
    envelope.manifest.items = [{ ...image, id: "birthday-test-item", durationSeconds: 60, dynamicTemplate: payload }, { ...image, id: "after-birthday", title: "Normale vervolgslide", durationSeconds: 60 }];
    const shown: string[] = [];
    await page.route("**/api/player/heartbeat", (route) => { const body = route.request().postDataJSON(); if (body.activeReleaseId) shown.push(body.activeReleaseId); return route.fulfill({ json: { ok: true } }); });
    await page.route("**/api/player/manifest*", (route) => route.fulfill({ json: envelope }));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(slide.getByText("Actuele thuisploeg", { exact: true })).toBeVisible();
    await expect(slide).toHaveAttribute("data-original-dom", "preserved");
    await page.route("**/api/player/manifest*", (route) => route.fulfill({ status: 503, json: { error: { code: "PLAYER_API_UNAVAILABLE" } } }));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(slide.getByText("Actuele thuisploeg", { exact: true })).toBeVisible();
    expect(shown.every((id) => id === envelope.manifest.releaseId)).toBe(true);
  });
}
