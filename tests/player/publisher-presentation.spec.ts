import { expect, test } from "@playwright/test";

import type {
  PlayerManifestEnvelope,
  PlayerManifestItem
} from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("renders only the active publisher item with crop, background and transition", async ({
  page
}) => {
  const baseline = await readBaselineManifest(page);
  const activeItem: PlayerManifestItem = {
    ...baseline.manifest.items[0]!,
    accessibilityName: "Toegankelijke sponsorafbeelding",
    backgroundColor: "#102030",
    cropFocus: { x: 0.2, y: 0.8 },
    displayTitle: "Interne sponsortitel",
    id: "publisher-active-image",
    transition: "wipe",
    visibility: {
      from: new Date(Date.now() - 60_000).toISOString(),
      until: new Date(Date.now() + 60_000).toISOString()
    }
  };
  const manifest = releaseWithItems(baseline, [
    {
      ...baseline.manifest.items[2]!,
      displayTitle: "Uitgeschakeld item",
      enabled: false,
      id: "publisher-disabled-image"
    },
    activeItem
  ]);

  await routeManifest(page, manifest);
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);

  const image = page.getByRole("img", {
    name: "Toegankelijke sponsorafbeelding"
  });
  const scene = page.locator('[data-player-transition="wipe"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("object-position", "20% 80%");
  await expect(image).toHaveCSS("background-color", "rgb(16, 32, 48)");
  await expect(scene).toHaveCSS("animation-name", /player-wipe/);
  await expect(
    page.getByRole("img", { name: "Kantine nieuws" })
  ).toHaveCount(0);
  await expect(page.getByText("Interne sponsortitel")).toHaveCount(0);
  await expect(page.getByText("Uitgeschakeld item")).toHaveCount(0);
});

test("applies video volume and trim without exposing publisher titles", async ({
  page
}) => {
  const baseline = await readBaselineManifest(page);
  const video: PlayerManifestItem = {
    ...baseline.manifest.items[1]!,
    accessibilityName: "Toegankelijke video-omschrijving",
    displayTitle: "Interne videonaam",
    durationSeconds: 30,
    id: "publisher-trimmed-video",
    muted: false,
    transition: "crossfade",
    trim: { endSeconds: 12, startSeconds: 4 },
    volumePercent: 35
  };
  const fallback: PlayerManifestItem = {
    ...baseline.manifest.items[0]!,
    id: "publisher-video-fallback",
    title: "Volgend beeld",
    transition: "crossfade"
  };

  await routeManifest(page, releaseWithItems(baseline, [video, fallback]));
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=30000`);

  const playerVideo = page.getByTestId("player-video");
  await expect(playerVideo).toBeVisible();
  await expect(playerVideo).toHaveAttribute(
    "aria-label",
    "Toegankelijke video-omschrijving"
  );
  await expect
    .poll(() => playerVideo.evaluate((element) => element.volume))
    .toBe(0.35);
  await expect(
    page.locator('[data-player-transition="crossfade"]')
  ).toHaveCSS("animation-name", /player-crossfade/);
  await expect(page.getByText("Interne videonaam")).toHaveCount(0);

  await playerVideo.evaluate((element) => {
    Object.defineProperty(element, "currentTime", {
      configurable: true,
      value: 12
    });
    element.dispatchEvent(new Event("timeupdate", { bubbles: true }));
  });

  await expect(page.getByRole("img", { name: "Volgend beeld" })).toBeVisible();
  await expect(
    page.locator('[data-player-transition-outgoing="crossfade"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-player-transition-outgoing="crossfade"]')
  ).toHaveCount(0, { timeout: 1_000 });
});

test("reduces wipe and crossfade to a cut when reduced motion is requested", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const baseline = await readBaselineManifest(page);
  const item: PlayerManifestItem = {
    ...baseline.manifest.items[0]!,
    id: "publisher-reduced-motion",
    transition: "wipe"
  };

  await routeManifest(page, releaseWithItems(baseline, [item]));
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);

  await expect(page.locator('[data-player-transition="wipe"]')).toHaveCSS(
    "animation-name",
    "none"
  );
});

async function readBaselineManifest(
  page: Parameters<typeof test>[0]["page"]
) {
  const response = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as PlayerManifestEnvelope;
}

function releaseWithItems(
  baseline: PlayerManifestEnvelope,
  items: PlayerManifestItem[]
): PlayerManifestEnvelope {
  const releaseId = "91919191-9191-4919-8919-919191919191";
  return {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: releaseId,
      desiredReleaseId: releaseId
    },
    manifest: {
      ...baseline.manifest,
      items,
      manifestHash: "9".repeat(64),
      releaseId,
      totalBytes: items.reduce(
        (total, item) =>
          total + item.source.bytes + (item.source.posterBytes ?? 0),
        0
      ),
      totalDurationSeconds: items.reduce(
        (total, item) => total + item.durationSeconds,
        0
      ),
      version: 91
    }
  };
}

async function routeManifest(
  page: Parameters<typeof test>[0]["page"],
  manifest: PlayerManifestEnvelope
) {
  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({
      body: JSON.stringify(manifest),
      contentType: "application/json"
    })
  );
}
