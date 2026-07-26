import { expect, test } from "@playwright/test";

import type { PlayerManifestEnvelope } from "../../apps/player/app/_lib/player-manifest";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("fetches an online release manifest and starts playback", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );

  expect(manifestResponse.ok()).toBe(true);
  const manifestBody = (await manifestResponse.json()) as { state: string };
  expect(manifestBody.state).toBe("PLAYING");

  const playerResponse = await page.goto(
    `${playerURL}/?deviceToken=demo-online&durationMs=750`
  );
  expect(playerResponse?.headers()["content-security-policy"]).toContain(
    "http://127.0.0.1:54321"
  );

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
  await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
  await expect(page.getByLabel("Pairingcode")).toHaveCount(0);
  await expect(page.locator(".playback-now")).toHaveCount(0);
  await expect(page.getByTestId("player-brand-mark")).toBeVisible();
  await expect(page.getByTestId("player-brand-mark")).toHaveCSS("opacity", "0.4");
});

test("advances three naturally ended videos without freezing between items", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  const baseline = (await manifestResponse.json()) as PlayerManifestEnvelope;
  const videoTemplate = baseline.manifest.items[1]!;
  const videos = ["Video een", "Video twee", "Video drie"].map((title, index) => ({
    ...videoTemplate,
    durationSeconds: 10,
    id: `ordered-video-${index + 1}`,
    title
  }));
  const manifest: PlayerManifestEnvelope = {
    ...baseline,
    device: {
      ...baseline.device,
      activeReleaseId: "66666666-6666-4666-8666-666666666666",
      desiredReleaseId: "66666666-6666-4666-8666-666666666666"
    },
    manifest: {
      ...baseline.manifest,
      items: videos,
      manifestHash: "6".repeat(64),
      releaseId: "66666666-6666-4666-8666-666666666666",
      totalBytes: (videoTemplate.source.posterBytes ?? 0) * videos.length,
      totalDurationSeconds: 30,
      version: 6
    }
  };

  await page.route("**/api/player/manifest", (route) =>
    route.fulfill({ body: JSON.stringify(manifest), contentType: "application/json" })
  );
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=2000`);

  const firstVideo = page.getByLabel("Video een");
  await expect(firstVideo).toBeVisible();
  await firstVideo.dispatchEvent("playing");
  await firstVideo.dispatchEvent("ended");

  const secondVideo = page.getByLabel("Video twee");
  await expect(secondVideo).toBeVisible({ timeout: 500 });
  await expect(firstVideo).toHaveCount(0);
  await secondVideo.dispatchEvent("playing");
  await secondVideo.dispatchEvent("ended");

  const thirdVideo = page.getByLabel("Video drie");
  await expect(thirdVideo).toBeVisible({ timeout: 500 });
});

test("loops to the muted video slot without browser controls", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=300`);

  const video = page.getByTestId("player-video");
  await expect(video).toBeVisible({ timeout: 3_000 });
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).not.toHaveAttribute("controls", /.*/);
  await expect(video).toHaveAttribute(
    "controlslist",
    "nodownload nofullscreen noplaybackrate"
  );
  await expect(video).toHaveAttribute("disablepictureinpicture", "");
  await expect(video).toHaveAttribute("preload", "auto");
  await expect(video).toHaveAttribute("tabindex", "-1");
  await expect(video).toHaveCSS("pointer-events", "none");
  await expect(page.getByLabel("Player diagnostics")).toContainText("Item 2 van 3");
});

test("shows a recoverable state for an unknown device token", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=unknown-device`);

  await expect(
    page.getByRole("heading", { name: "Player opnieuw koppelen" })
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "De device token hoort niet bij een actief scherm."
  );
  await expect(page.getByRole("status")).toContainText(
    "Zonder last-known-good release blijft de player in herstelstatus."
  );
});
