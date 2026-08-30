import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const deviceToken = "l".repeat(48);
const deliveryId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";

test("toont één realtime Goal Alert boven last-known-good playback en pauzeert de onderlaag", async ({ page }) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const manifest = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const acknowledgements: Array<{ status?: string }> = [];
  let realtimeAuthorization: string | undefined;

  await page.route("**/api/player/manifest", (route) => route.fulfill({
    body: JSON.stringify(manifest),
    contentType: "application/json"
  }));
  await page.route("**/api/player/installation", (route) => route.fulfill({
    body: JSON.stringify({ bound: true, installationCredential: "i".repeat(48), ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    body: JSON.stringify({ automation: null, ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime/ack", async (route) => {
    acknowledgements.push(JSON.parse(route.request().postData() ?? "{}") as { status?: string });
    await route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json" });
  });
  await page.route("**/api/player/realtime", async (route) => {
    realtimeAuthorization = route.request().headers().authorization;
    const now = Date.now();
    const stream = [
      sse("bootstrap", { configs: [], screenId: "33333333-3333-4333-8333-333333333333", serverTime: new Date(now).toISOString() }),
      sse("goal", {
        alertVersionId: "44444444-4444-4444-8444-444444444444",
        assets: [],
        executeAt: new Date(now + 250).toISOString(),
        expiresAt: new Date(now + 4_000).toISOString(),
        id: deliveryId,
        kind: "goal",
        payload: {
          awayScore: 0,
          awayTeam: "Tegenstander",
          design: {
            animation: "impact",
            headline: "GOAL!",
            logoPosition: "left",
            palette: "electric-orange",
            scorerFallback: "Doelpunt!",
            secondaryText: "Voor Duindorp",
            showClock: true,
            showPreviousScore: true,
            showScorer: true,
            typography: "display"
          },
          durationMs: 2_000,
          eventId,
          eventKind: "live",
          homeScore: 1,
          homeTeam: "Duindorp sv 1",
          matchClock: "12:34",
          previousAwayScore: 0,
          previousHomeScore: 0,
          scorerName: "Speler 9",
          scoringSide: "own",
          underlayPolicy: "pause"
        },
        screenId: "33333333-3333-4333-8333-333333333333",
        serverTime: new Date(now).toISOString()
      })
    ].join("");
    await route.fulfill({
      body: stream,
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });

  await page.goto(`${playerURL}/?deviceToken=${deviceToken}&durationMs=400`);

  const overlay = page.getByTestId("ledscores-goal-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("GOAL!", { exact: true })).toBeVisible();
  await expect(overlay).toContainText("1–0");
  await expect(overlay).toContainText("Speler 9");
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  expect(realtimeAuthorization).toBe(`Bearer ${deviceToken}`);
  await expect.poll(() => acknowledgements.some((item) => item.status === "rendered")).toBe(true);
  await expect(overlay).toHaveCount(0, { timeout: 4_000 });
  expect(acknowledgements.filter((item) => item.status === "rendered")).toHaveLength(1);
});

test("plant hetzelfde goal-event op drie Players met begrensde renderskew", async ({ browser, request }) => {
  const manifestResponse = await request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const manifest = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const executeAtMs = Date.now() + 5_000;
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext()
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await Promise.all(pages.map(async (target, index) => {
      await target.addInitScript(() => {
        const measuredWindow = window as Window & { __ledScoresRenderedAt?: number };
        measuredWindow.__ledScoresRenderedAt = 0;
        const observe = () => {
          const observer = new MutationObserver(() => {
            if (!measuredWindow.__ledScoresRenderedAt && document.querySelector('[data-testid="ledscores-goal-overlay"]')) {
              measuredWindow.__ledScoresRenderedAt = Date.now();
              observer.disconnect();
            }
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.documentElement) observe();
        else document.addEventListener("DOMContentLoaded", observe, { once: true });
      });
      await target.route("**/api/player/manifest", (route) => route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" }));
      await target.route("**/api/player/installation", (route) => route.fulfill({ body: JSON.stringify({ bound: true, installationCredential: "i".repeat(48), ok: true }), contentType: "application/json" }));
      await target.route("**/api/player/heartbeat", (route) => route.fulfill({ body: JSON.stringify({ automation: null, ok: true }), contentType: "application/json" }));
      await target.route("**/api/player/commands", (route) => route.fulfill({ body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() }), contentType: "application/json" }));
      await target.route("**/api/player/realtime/ack", (route) => route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json" }));
      await target.route("**/api/player/realtime", (route) => {
        const serverTime = new Date().toISOString();
        return route.fulfill({
          body: sse("goal", {
            alertVersionId: "44444444-4444-4444-8444-444444444444",
            assets: [],
            executeAt: new Date(executeAtMs).toISOString(),
            expiresAt: new Date(executeAtMs + 4_000).toISOString(),
            id: `${index + 5}1111111-1111-4111-8111-111111111111`,
            kind: "goal",
            payload: {
              awayScore: 0,
              awayTeam: "Tegenstander",
              design: {
                animation: "none", headline: "GOAL!", logoPosition: "left",
                palette: "electric-orange", scorerFallback: "Doelpunt!", secondaryText: "",
                showClock: false, showPreviousScore: false, showScorer: false, typography: "display"
              },
              durationMs: 2_000,
              eventId,
              eventKind: "live",
              homeScore: 1,
              homeTeam: "Duindorp sv 1",
              previousAwayScore: 0,
              previousHomeScore: 0,
              scoringSide: "own",
              underlayPolicy: "continue"
            },
            screenId: `${index + 7}3333333-3333-4333-8333-333333333333`,
            serverTime
          }),
          contentType: "text/event-stream; charset=utf-8"
        });
      });
    }));

    await Promise.all(pages.map((target, index) => target.goto(
      `${playerURL}/?deviceToken=${String(index + 1).repeat(48)}&durationMs=5000`
    )));
    await Promise.all(pages.map((target) => expect(target.getByTestId("ledscores-goal-overlay")).toBeVisible({ timeout: 10_000 })));
    const renderedAt = await Promise.all(pages.map((target) => target.evaluate(() =>
      (window as Window & { __ledScoresRenderedAt?: number }).__ledScoresRenderedAt ?? 0
    )));
    const latencies = renderedAt.map((value) => value - executeAtMs);
    expect(Math.max(...renderedAt) - Math.min(...renderedAt)).toBeLessThanOrEqual(250);
    expect(Math.max(...latencies)).toBeLessThanOrEqual(1_000);
    expect(Math.min(...latencies)).toBeGreaterThanOrEqual(-50);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

function sse(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}
