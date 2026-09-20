import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("polls, deduplicates and activates a verified release on the next item boundary", async ({ page }) => {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await response.json()) as PlayerManifestEnvelope;
  const item = baseline.manifest.items[0];
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
      totalDurationSeconds: 1
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
  servePending = true;

  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Nieuwe inhoud gereed; wisselt na de huidige slide.",
    { timeout: 3_000 }
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Periodieke sync nieuw",
    { timeout: 4_000 }
  );
  await expect.poll(() => manifestRequests).toBeGreaterThanOrEqual(2);
});

test("does not activate a pending release after the desired release is withdrawn", async ({ page }) => {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await response.json()) as PlayerManifestEnvelope;
  const item = baseline.manifest.items[0];
  const activeEnvelope: PlayerManifestEnvelope = {
    ...baseline,
    device: { ...baseline.device, desiredReleaseId: baseline.manifest.releaseId },
    manifest: {
      ...baseline.manifest,
      items: [item],
      label: "Gewenste release A",
      totalBytes: item.source.bytes,
      totalDurationSeconds: 2
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

  responseEnvelope = pendingEnvelope;
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Nieuwe inhoud gereed; wisselt na de huidige slide.",
    { timeout: 3_000 }
  );
  responseEnvelope = activeEnvelope;
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "actieve release is ongewijzigd",
    { timeout: 3_000 }
  );
  await page.waitForTimeout(2_250);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Gewenste release A");
  await expect(page.getByLabel("Player diagnostics")).not.toContainText(
    "Ingetrokken release B"
  );
});
