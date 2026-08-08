import { expect, test } from "@playwright/test";

import { routeLandscapeRssManifest } from "./rss-portrait-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("toont de landscape RSS-slide als eigen dynamische HTML/CSS-compositie", async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.setViewportSize({ height: 1080, width: 1920 });
  await routeLandscapeRssManifest(page, playerURL);
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  const slide = page.getByLabel("Dynamisch voetbalnieuws");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-slide-type", "news");
  await expect(slide).toHaveAttribute("data-orientation", "landscape");
  expect(await slide.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--arena-accent").trim()
  )).toBe("#315cff");

  const headline = page.getByRole("heading", {
    name: "De eerste dynamische voetbalheadline staat live"
  });
  await expect(headline).toBeVisible();
  expect((await headline.boundingBox())?.x).toBeGreaterThan(1920 * 0.45);
  const motion = await slide.evaluate((root) => {
    const elements = [
      root.querySelector("main > div > section"),
      root.querySelector("main article h2"),
      root.querySelector("main article > p"),
      root.querySelector("main article > span"),
      root.querySelector("main article > div"),
      root.querySelector("header"),
      root.querySelector("footer")
    ];
    return elements.map((element) => {
      const style = element ? getComputedStyle(element) : null;
      return {
        delayMs: style
          ? Number.parseFloat(style.animationDelay || "0") * 1000
          : -1,
        name: style?.animationName ?? ""
      };
    });
  });
  expect(motion.map(({ delayMs }) => Math.round(delayMs))).toEqual([
    0,
    260,
    520,
    760,
    760,
    900,
    1020
  ]);
  expect(motion.every(({ name }) => name !== "none")).toBe(true);

  const sectionTitle = page.getByText("Voetbalnieuws", { exact: true });
  await expect(sectionTitle).toHaveCSS("color", "rgb(243, 240, 233)");

  const supplierLogo = page.getByRole("img", { name: "AD:voetbal" });
  await expect(supplierLogo).toBeVisible();
  expect((await supplierLogo.boundingBox())?.height).toBeLessThanOrEqual(75);
  const photoBox = await slide.locator("main section").first().boundingBox();
  expect(photoBox).not.toBeNull();
  expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 2);
  await expect(page.getByTestId("player-brand-mark")).toHaveCSS(
    "opacity",
    "0.4"
  );
  await expect(slide.locator("canvas")).toHaveCount(0);
  expect(await slide.locator("*").count()).toBeGreaterThan(20);
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: "docs/screenshots/s91-editorial-arena-news-landscape.png"
    });
  }
  await expect(slide.locator('[data-page-index="1"]')).toBeVisible({
    timeout: 7_000
  });
  await expect(
    page.getByRole("heading", {
      name: "Ook het tweede bericht gebruikt echte HTML en CSS"
    })
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("respecteert minder beweging zonder inhoud te verbergen", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1080, width: 1920 });
  await routeLandscapeRssManifest(page, playerURL);
  await page.goto(`${playerURL}/?deviceToken=demo-online`);

  const headline = page.getByRole("heading", {
    name: "De eerste dynamische voetbalheadline staat live"
  });
  const intro = page.getByText(
    "Het laatste voetbalnieuws staat klaar voor leden en bezoekers."
  );
  await expect(headline).toBeVisible();
  await expect(intro).toBeVisible();
  await expect(headline).toHaveCSS("animation-name", "none");
  await expect(intro).toHaveCSS("animation-name", "none");
});
