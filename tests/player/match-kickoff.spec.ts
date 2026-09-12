import { expect, test } from "@playwright/test";
import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";
import { defaultGoalOverlayConfiguration } from "../../packages/contracts/src/goal-overlay";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    for (const [slideType, lastRow, withGoal] of [["sport_program", false, false], ["sport_program", true, false], ["sport_program", true, true], ["sport_results", false, false]] as const) {
      test(`${legacy ? "LG" : "React"} ${orientation}: ${slideType}${lastRow ? " laatste rij" : ""}${withGoal ? " tijdens goal" : ""} respecteert aftrap zonder uitslag`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize(orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
        const baseline = await (await page.request.get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)).json() as PlayerManifestEnvelope;
        const instant = Date.now();
        await page.clock.install({ time: new Date(instant) });
        const fixtures = [
          { id: "started", homeTeam: "Al gestart", kickoffAt: new Date(instant - 60_000).toISOString() },
          { id: "starting", homeTeam: "Nu startend", kickoffAt: new Date(instant + 30_000).toISOString() },
          { id: "future", homeTeam: "Later vandaag", kickoffAt: new Date(instant + 3_600_000).toISOString() }
        ].map((row) => ({ ...row, awayTeam: "Tegenstander", primary: `${row.homeTeam} – Tegenstander`, date: "12-09-2026", time: "16:00", status: "scheduled", homeScore: null, awayScore: null }));
        const item = {
          ...baseline.manifest.items[0]!,
          id: "match-cutoff-slide",
          durationSeconds: 120,
          dynamicTemplate: {
            assets: {},
            data: { type: slideType, brand: { clubName: "Aftraptest" }, sport: { title: "Aftraptest", items: slideType === "sport_results" ? [fixtures[0]] : lastRow ? [fixtures[1]] : fixtures } },
            orientation,
            schemaVersion: 1 as const,
            slideType,
            snapshotHash: "a".repeat(64),
            snapshotId: "11111111-1111-4111-8111-111111111176",
            templateVersionId: "22222222-2222-4222-8222-222222221176",
            templateSlug: `editorial-arena-${slideType === "sport_program" ? "programma" : "uitslagen"}-light-${orientation}`
          }
        };
        const normal = { ...baseline.manifest.items[0]!, id: "normal-playlist", title: "Normale playlist", accessibilityName: "Normale playlist" };
        const envelope = { ...baseline, manifest: { ...baseline.manifest, items: lastRow ? [item, normal] : [item], totalDurationSeconds: 120 + (lastRow ? normal.durationSeconds : 0) } };
        await page.route(/\/api\/player\/manifest(?:\?.*)?$/, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope) }));
        await page.route("**/api/player/heartbeat", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ accepted: true }) }));
        let sent = false;
        await page.route("**/api/player/realtime", (route) => {
          const delivery = {
            id: "11111111-1111-4111-8111-111111111177", alertVersionId: "44444444-4444-4444-8444-444444444444", assets: [],
            executeAt: new Date(instant + 10_000).toISOString(), expiresAt: new Date(instant + 120_000).toISOString(), serverTime: new Date(instant).toISOString(), kind: "goal",
            payload: {
              eventId: "22222222-2222-4222-8222-222222221177", eventKind: "synthetic_test",
              goalOverlay: { ...defaultGoalOverlayConfiguration, overlayDurationMs: 30_000, enterAnimation: "none", exitAnimation: "none", transitionDurationMs: 0 },
              design: { headline: "GOAL!", palette: "ink-black", animation: "none" }, durationMs: 30_000, underlayPolicy: "pause", scoringSide: "own", scoreboardSide: "home",
              homeTeam: "Duindorp SV 2", awayTeam: "VUC 2", homeScore: 2, awayScore: 1, previousHomeScore: 1, previousAwayScore: 1
            }
          };
          const body = withGoal && !sent ? `event: goal\ndata: ${JSON.stringify(delivery)}\n\n` : ": heartbeat\n\n";
          sent = true;
          return route.fulfill({ contentType: "text/event-stream", body });
        });
        await page.route("**/api/player/realtime/ack", (route) => route.fulfill({ contentType: "application/json", body: '{"ok":true}' }));
        await page.addInitScript(() => {
          localStorage.setItem("veyocast.player.deviceToken", "k".repeat(48));
          localStorage.setItem("veyocast.player.installationCredential", "i".repeat(48));
          localStorage.setItem("veyocast.player.instanceId", "kickoff-test-installation");
        });
        await page.goto(`${playerURL}/${legacy ? "lg/legacy" : `?deviceToken=${"k".repeat(48)}`}`);
        await page.evaluate(() => { document.documentElement.dataset.cutoffDocument = "preserved"; });
        if (slideType === "sport_program") {
          await expect(page.getByText("Nu startend", { exact: true })).toBeVisible();
          if (!lastRow) await expect(page.getByText("Later vandaag", { exact: true })).toBeVisible();
          await expect(page.getByText("Al gestart", { exact: true })).toHaveCount(0);
          if (withGoal) {
            await page.clock.fastForward(11_000);
            await expect(page.locator(".vc-goal")).toBeVisible();
          }
          await page.context().setOffline(true);
          await page.clock.fastForward(withGoal ? 20_000 : 31_000);
          if (withGoal) {
            await expect(page.locator(".vc-goal")).toBeVisible();
            await expect(page.getByText("Nu startend", { exact: true })).toBeVisible();
            await page.clock.fastForward(11_000);
            await expect(page.locator(".vc-goal")).toHaveCount(0);
          }
          await expect(page.getByText("Nu startend", { exact: true })).toHaveCount(0);
          if (lastRow) {
            await expect(page.getByRole("img", { name: "Normale playlist", exact: true })).toBeVisible();
          } else {
            await expect(page.getByText("Later vandaag", { exact: true })).toBeVisible();
          }
        } else {
          await expect(page.getByText("Al gestart", { exact: true })).toBeVisible();
          await expect(page.getByText("Later vandaag", { exact: true })).toHaveCount(0);
          await expect(page.getByText("Nu startend", { exact: true })).toHaveCount(0);
          const score = page.getByLabel("Uitslag nog niet bekend", { exact: true });
          await expect(score).toHaveCount(1);
          await expect(score).toHaveText("");
        }
        expect(await page.evaluate(() => document.documentElement.dataset.cutoffDocument)).toBe("preserved");
        expect(errors).toEqual([]);
      });
    }
  }
}
