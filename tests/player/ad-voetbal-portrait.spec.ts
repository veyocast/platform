import { expect, test } from "@playwright/test";

import { routePortraitRssManifest } from "./rss-portrait-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("toont de portrait RSS-slide als dynamische HTML/CSS Playercontent", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.setViewportSize({ height: 1920, width: 1080 });
  await routePortraitRssManifest(page, playerURL);
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  const slide = page.getByLabel("Dynamisch voetbalnieuws");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-slide-type", "news");
  await expect(slide).toHaveAttribute("data-orientation", "portrait");
  await expect(
    page.getByRole("heading", {
      name: "De eerste dynamische voetbalheadline staat live"
    })
  ).toBeVisible();
  await expect(page.getByText("Voetbalnieuws", { exact: true })).toHaveCSS(
    "color",
    "rgb(243, 240, 233)"
  );
  const supplierLogo = page.getByRole("img", { name: "AD:voetbal" });
  await expect(supplierLogo).toBeVisible();
  expect((await supplierLogo.boundingBox())?.height).toBeLessThanOrEqual(75);
  await expect(page.getByTestId("player-brand-mark")).toHaveCSS(
    "opacity",
    "0.4"
  );
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: "docs/screenshots/s91-editorial-arena-news-portrait.png"
    });
  }
  expect(browserErrors).toEqual([]);
});
