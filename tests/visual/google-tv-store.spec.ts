import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const outputDirectory = resolve(
  "apps/android-tv/play-tv/graphics/tv-screenshots"
);

test.skip(
  process.env.VEYOCAST_CAPTURE_GOOGLE_TV !== "1",
  "Storecaptures worden alleen bewust opnieuw gegenereerd."
);

test.use({
  colorScheme: "dark",
  deviceScaleFactor: 1,
  viewport: { height: 1080, width: 1920 }
});

test.beforeAll(async () => {
  await mkdir(outputDirectory, { recursive: true });
});

test("legt afzonderlijke Google TV-winkelbeelden vast", async ({
  context,
  page
}) => {
  await page.goto(playerURL);
  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: resolve(outputDirectory, "01-koppelen-1920x1080.png")
  });

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=30000`);
  await expect(page.getByLabel("Release playback")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: resolve(outputDirectory, "02-fullscreen-content-1920x1080.png")
  });

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator(".player-offline-chip")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: resolve(outputDirectory, "03-offline-doorgaan-1920x1080.png")
  });
});
