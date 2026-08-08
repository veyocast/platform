import { expect, test } from "@playwright/test";

import {
  longNewsTitle,
  mediumNewsTitle,
  routePortraitRssManifest
} from "./rss-portrait-fixture";

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
      name: mediumNewsTitle
    })
  ).toBeVisible();
  await expect(page.getByText("Voetbalnieuws", { exact: true })).toHaveCSS(
    "color",
    "rgb(243, 240, 233)"
  );
  const supplierLogo = page.getByRole("img", { name: "AD:voetbal" });
  await expect(supplierLogo).toBeVisible();
  expect((await supplierLogo.boundingBox())?.height).toBeLessThanOrEqual(75);
  const photo = slide.locator("main section").first();
  const photoBox = await photo.boundingBox();
  expect(photoBox).not.toBeNull();
  expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 2);
  await expect(photo.locator("img").first()).toHaveCSS(
    "object-fit",
    "contain"
  );

  const story = slide.locator("main article");
  await expect(story).toHaveCSS("justify-content", "flex-start");
  const mediumTitle = page.getByRole("heading", { name: mediumNewsTitle });
  const mediumTitleSize = Number.parseFloat(
    await mediumTitle.evaluate((element) => getComputedStyle(element).fontSize)
  );
  const intro = page.getByText(
    "Het laatste voetbalnieuws staat klaar voor leden en bezoekers."
  );
  expect(Number.parseFloat(
    await intro.evaluate((element) => getComputedStyle(element).fontSize)
  )).toBeGreaterThanOrEqual(26);
  const meta = story.locator("div").last();
  await expect(meta).toHaveCSS("border-top-style", "solid");
  const [storyBox, metaBox] = await Promise.all([
    story.boundingBox(),
    meta.boundingBox()
  ]);
  expect(storyBox).not.toBeNull();
  expect(metaBox).not.toBeNull();
  expect(storyBox!.y + storyBox!.height - (metaBox!.y + metaBox!.height))
    .toBeLessThan(70);
  expect(await meta.locator("small").count()).toBe(2);
  expect(Number.parseFloat(
    await meta.locator("small").first().evaluate(
      (element) => getComputedStyle(element).fontSize
    )
  )).toBeGreaterThanOrEqual(20);

  const longTitle = page.getByRole("heading", { name: longNewsTitle });
  await expect(longTitle).toBeVisible({ timeout: 7_000 });
  const longTitleSize = Number.parseFloat(
    await longTitle.evaluate((element) => getComputedStyle(element).fontSize)
  );
  expect(longTitleSize).toBeCloseTo(mediumTitleSize, 2);
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
  await page.setViewportSize({ height: 1080, width: 1920 });
  await expect.poll(async () => {
    const box = await slide.boundingBox();
    return box ? {
      bottom: Math.round(box.y + box.height),
      height: Math.round(box.height),
      left: Math.round(box.x),
      right: Math.round(box.x + box.width),
      top: Math.round(box.y)
    } : null;
  }).toEqual({
    bottom: 1080,
    height: 1080,
    left: 656,
    right: 1264,
    top: 0
  });
  expect(browserErrors).toEqual([]);
});
