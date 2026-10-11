import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const production=process.env.PLAYWRIGHT_PRODUCTION_SERVERS==="1";
const syncWindow=production?11_000:3_000;

test("polls, deduplicates and activates a verified release on the next item boundary", async ({ page }) => {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await response.json()) as PlayerManifestEnvelope;
  const item = {...baseline.manifest.items[0],durationSeconds:12};
  let manifestRequests = 0;
  let servePending = false;
  const activeEnvelope: PlayerManifestEnvelope = {
    ...baseline,
    device: { ...baseline.device, desiredReleaseId: baseline.manifest.releaseId },
    manifest: {
      ...baseline.manifest,
      items: [item],
      label: "Periodieke sync actief",
      totalBytes: item.source.bytes,
      totalDurationSeconds: 12
    }
  };
  const pendingEnvelope: PlayerManifestEnvelope = {
    ...activeEnvelope,
    device: {
      ...activeEnvelope.device,
      desiredReleaseId: "99999999-9999-4999-8999-999999999999"
    },
    manifest: {
      ...activeEnvelope.manifest,
      label: "Periodieke sync nieuw",
      manifestHash: "d".repeat(64),
      releaseId: "99999999-9999-4999-8999-999999999999",
      version: activeEnvelope.manifest.version + 1
    }
  };

  await page.route("**/api/player/manifest", (route) => {
    manifestRequests += 1;
    const body = servePending ? pendingEnvelope : activeEnvelope;
    return route.fulfill({ body: JSON.stringify(body), contentType: "application/json" });
  });

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=1000&syncMs=250`);
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Periodieke sync actief"
  );
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();
  servePending = true;

  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Nieuwe inhoud gereed; wisselt na de huidige slide.",
    { timeout: syncWindow }
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Periodieke sync nieuw",
    { timeout: production?6_000:4_000 }
  );
  await expect.poll(() => manifestRequests).toBeGreaterThanOrEqual(2);
});

test("does not activate a pending release after the desired release is withdrawn", async ({ page }) => {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await response.json()) as PlayerManifestEnvelope;
  const item = {...baseline.manifest.items[0],durationSeconds:18};
  const activeEnvelope: PlayerManifestEnvelope = {
    ...baseline,
    device: { ...baseline.device, desiredReleaseId: baseline.manifest.releaseId },
    manifest: {
      ...baseline.manifest,
      items: [item],
      label: "Gewenste release A",
      totalBytes: item.source.bytes,
      totalDurationSeconds: 18
    }
  };
  const pendingEnvelope: PlayerManifestEnvelope = {
    ...activeEnvelope,
    device: {
      ...activeEnvelope.device,
      desiredReleaseId: "88888888-8888-4888-8888-888888888888"
    },
    manifest: {
      ...activeEnvelope.manifest,
      label: "Ingetrokken release B",
      manifestHash: "e".repeat(64),
      releaseId: "88888888-8888-4888-8888-888888888888",
      version: activeEnvelope.manifest.version + 1
    }
  };
  let responseEnvelope = activeEnvelope;

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({
      body: JSON.stringify(responseEnvelope),
      contentType: "application/json"
    })
  );
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=2000&syncMs=250`);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Gewenste release A");
  await expect(page.locator('[data-player-handoff="first-frame-ready"]')).toBeAttached();

  responseEnvelope = pendingEnvelope;
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Nieuwe inhoud gereed; wisselt na de huidige slide.",
    { timeout: syncWindow }
  );
  responseEnvelope = activeEnvelope;
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "actieve release is ongewijzigd",
    { timeout: syncWindow }
  );
  await page.waitForTimeout(production?3_250:2_250);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Gewenste release A");
  await expect(page.getByLabel("Player diagnostics")).not.toContainText(
    "Ingetrokken release B"
  );
});
