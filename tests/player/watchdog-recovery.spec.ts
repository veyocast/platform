import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("does not remount a healthy video when no watchdog override is present", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const video = {
    ...baseline.manifest.items[1],
    durationSeconds: 30,
    id: "stable-default-watchdog-video",
    title: "Stabiele video"
  };
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: "55555555-5555-4555-8555-555555555556",
      desiredReleaseId: "55555555-5555-4555-8555-555555555556"
    },
    manifest: {
      ...baseline.manifest,
      items: [video],
      manifestHash: "5".repeat(64),
      releaseId: "55555555-5555-4555-8555-555555555556",
      totalBytes: video.source.posterBytes ?? 0,
      totalDurationSeconds: 30,
      version: 5
    }
  };

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" })
  );
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  const playerVideo = page.getByTestId("player-video");
  await expect(playerVideo).toBeVisible();
  await playerVideo.evaluate((element) => {
    element.dataset.playbackInstance = "original";
    element.dispatchEvent(new Event("playing", { bubbles: true }));
  });
  await page.waitForTimeout(1_500);

  await expect(playerVideo).toHaveAttribute("data-playback-instance", "original");
  await expect(page.getByLabel("Player diagnostics")).not.toContainText(
    "Playbackfout"
  );
});

test("does not treat an intentional video pause as a playback stall", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const video = {
    ...baseline.manifest.items[1],
    durationSeconds: 30,
    id: "intentional-pause-video",
    title: "Bewust gepauzeerde video"
  };
  const fallback = {
    ...baseline.manifest.items[0],
    id: "pause-watchdog-fallback",
    title: "Onterechte watchdogfallback"
  };
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    manifest: {
      ...baseline.manifest,
      items: [video, fallback],
      manifestHash: "6".repeat(64),
      releaseId: "66666666-6666-4666-8666-666666666666",
      totalDurationSeconds: 40,
      version: 6
    }
  };

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({
      body: JSON.stringify(manifest),
      contentType: "application/json"
    })
  );
  await page.goto(
    `${playerURL}/?deviceToken=demo-online&durationMs=30000&watchdogMs=500`
  );

  const playerVideo = page.getByTestId("player-video");
  await expect(playerVideo).toBeVisible();
  await playerVideo.evaluate((element) => {
    element.dispatchEvent(new Event("playing", { bubbles: true }));
    element.autoplay = false;
    element.pause();
    element.dispatchEvent(new Event("pause", { bubbles: true }));
  });
  await page.waitForTimeout(1_500);

  await expect(playerVideo).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Onterechte watchdogfallback" })
  ).toHaveCount(0);
});

test("retries a decode failure once, skips it and reports recovery in heartbeat", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const invalidVideo = Buffer.from("invalid-mp4");
  const fallbackImage = {
    ...baseline.manifest.items[0],
    id: "watchdog-fallback",
    title: "Watchdog fallback"
  };
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: "77777777-7777-4777-8777-777777777777",
      desiredReleaseId: "77777777-7777-4777-8777-777777777777"
    },
    manifest: {
      ...baseline.manifest,
      label: "Watchdog recovery release",
      manifestHash: "7".repeat(64),
      releaseId: "77777777-7777-4777-8777-777777777777",
      totalBytes: invalidVideo.byteLength + fallbackImage.source.bytes,
      totalDurationSeconds: 40,
      version: 7,
      items: [
        {
          id: "invalid-video",
          kind: "video",
          title: "Ongeldige video",
          durationSeconds: 30,
          fitMode: "cover",
          muted: true,
          source: {
            bytes: invalidVideo.byteLength,
            checksumSha256: createHash("sha256").update(invalidVideo).digest("hex"),
            mimeType: "video/mp4",
            url: `${playerURL}/watchdog-invalid.mp4`
          }
        },
        fallbackImage
      ]
    }
  };
  const heartbeatBodies: Array<Record<string, unknown>> = [];

  await page.route("**/watchdog-invalid.mp4", (route) =>
    route.fulfill({ body: invalidVideo, contentType: "video/mp4" })
  );
  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" })
  );
  await page.route("**/api/player/heartbeat", (route) => {
    heartbeatBodies.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json" });
  });

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=10000&watchdogMs=250`);

  await expect(page.getByRole("img", { name: "Watchdog fallback" })).toBeVisible({
    timeout: 8_000
  });
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "niet-speelbaar item is overgeslagen"
  );
  await expect.poll(() => heartbeatBodies.length, { timeout: 5_000 }).toBeGreaterThan(0);

  const reportedErrors = heartbeatBodies
    .map((body) => body.lastPlaybackError)
    .filter(Boolean) as Array<{ action?: string; code?: string; itemId?: string; recoveredAt?: string }>;
  expect(reportedErrors).toContainEqual(
    expect.objectContaining({
      action: "SKIP_ITEM",
      code: expect.stringMatching(/^VIDEO_/),
      itemId: "invalid-video",
      recoveredAt: expect.any(String)
    })
  );
  await expect.poll(() => {
    const recoveredIndex = heartbeatBodies.findIndex((body) => {
      const error = body.lastPlaybackError as { recoveredAt?: string } | null | undefined;
      return Boolean(error?.recoveredAt);
    });
    return recoveredIndex >= 0 && heartbeatBodies
      .slice(recoveredIndex + 1)
      .some((body) => body.lastPlaybackError === null);
  }, { timeout: 5_000 }).toBe(true);
});

test("detects a stalled video that stops making time progress", async ({ page }) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const stalledVideo = {
    ...baseline.manifest.items[1],
    id: "stalled-video",
    title: "Stalled video",
    durationSeconds: 30
  };
  const fallbackImage = {
    ...baseline.manifest.items[0],
    id: "stall-fallback",
    title: "Stall fallback"
  };
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    manifest: {
      ...baseline.manifest,
      manifestHash: "8".repeat(64),
      releaseId: "88888888-8888-4888-8888-888888888888",
      totalBytes:
        (stalledVideo.source.posterBytes ?? 0) + fallbackImage.source.bytes,
      totalDurationSeconds: 40,
      version: 8,
      items: [stalledVideo, fallbackImage]
    }
  };

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" })
  );
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=10000&watchdogMs=1000`);

  const video = page.getByTestId("player-video");
  await expect(video).toBeVisible();
  await video.evaluate((element) => {
    element.dispatchEvent(new Event("playing", { bubbles: true }));
    element.dispatchEvent(new Event("stalled", { bubbles: true }));
  });

  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "Playbackfout VIDEO_STALLED_TIMEOUT",
    { timeout: 2_500 }
  );
  await expect(page.getByLabel("Player diagnostics")).toContainText(
    "opnieuw geprobeerd"
  );
});

test("hands a naturally ended video directly to the next playlist item", async ({ page }) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const endedVideo = {
    ...baseline.manifest.items[1],
    id: "ended-video",
    title: "Ended video",
    durationSeconds: 30
  };
  const nextImage = {
    ...baseline.manifest.items[0],
    id: "ended-next-image",
    title: "Na ended"
  };
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    manifest: {
      ...baseline.manifest,
      manifestHash: "9".repeat(64),
      releaseId: "99999999-9999-4999-8999-999999999998",
      totalBytes: (endedVideo.source.posterBytes ?? 0) + nextImage.source.bytes,
      totalDurationSeconds: 40,
      version: 9,
      items: [endedVideo, nextImage]
    }
  };

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" })
  );
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=2000`);

  const video = page.getByTestId("player-video");
  await expect(video).toBeVisible();
  await video.dispatchEvent("playing");
  await video.dispatchEvent("ended");

  await expect(page.getByRole("img", { name: "Na ended" })).toBeVisible({ timeout: 500 });
  await expect(video).toHaveCount(0);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Item 2 van 2");
});
