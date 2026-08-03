import { expect, test } from "@playwright/test";

import { routePortraitRssManifest } from "../player/rss-portrait-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("portrait nieuwsslide houdt kop, bron en positie toegankelijk", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1920, width: 1080 });
  await routePortraitRssManifest(page, playerURL);
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByLabel("Dynamisch voetbalnieuws")).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "De eerste dynamische voetbalheadline staat live"
  })).toBeVisible();
  await expect(page.getByText("Door", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
});
