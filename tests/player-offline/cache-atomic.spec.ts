import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("starts from last-known-good when manifest and media are unavailable", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");

  await page.route("**/api/player/manifest**", (route) => route.abort());
  await page.route("**/player-demo/**", (route) => route.abort());
  await page.goto(`${playerURL}/?durationMs=5000`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "OFFLINE_PLAYING"
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText("offline");
});

test("rejects corrupt pending assets without replacing active playback", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const onlineManifest = (await manifestResponse.json()) as PlayerManifestEnvelope;

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");

  await page.route("**/api/player/manifest**", (route) => {
    const corruptManifest = {
      ...onlineManifest,
      manifest: {
        ...onlineManifest.manifest,
        label: "Corrupt pending release",
        manifestHash: "c".repeat(64),
        releaseId: "99999999-9999-4999-8999-999999999999",
        version: 4,
        items: onlineManifest.manifest.items.map((item, index) =>
          index === 0
            ? {
                ...item,
                source: {
                  ...item.source,
                  checksumSha256: "f".repeat(64)
                }
              }
            : item
        )
      }
    };

    return route.fulfill({
      body: JSON.stringify(corruptManifest),
      contentType: "application/json",
      status: 200
    });
  });

  await page.goto(`${playerURL}/?durationMs=5000`);

  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Pending release is verworpen"
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
  await expect(page.getByLabel("Player diagnostics")).not.toContainText(
    "Corrupt pending release"
  );
});
