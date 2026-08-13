import { expect, test } from "@playwright/test";

import { routeEditorialPriceListManifest } from "./editorial-price-list-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

for (const orientation of ["landscape", "portrait"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`toont de ${theme} ${orientation} prijslijst als exacte dynamische HTML/CSS`, async ({
      page
    }) => {
      await page.setViewportSize(
        orientation === "portrait"
          ? { height: 1920, width: 1080 }
          : { height: 1080, width: 1920 }
      );
      await routeEditorialPriceListManifest(page, playerURL, orientation, theme);
      await page.goto(`${playerURL}/?deviceToken=demo-online`);

      const slide = page.getByLabel("Dynamische prijslijst");
      await expect(slide).toBeVisible();
      await expect(slide).toHaveAttribute("data-orientation", orientation);
      await expect(slide).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Prijslijst" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Linkerkolom" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Rechterkolom" })).toBeVisible();
      await expect(page.getByText("Dranken", { exact: true })).toBeVisible();
      await expect(page.getByText("Warme snacks", { exact: true })).toBeVisible();
      await expect(slide.locator("canvas")).toHaveCount(0);
      expect(await slide.locator("main article").count()).toBe(
        orientation === "portrait" ? 32 : 16
      );

      const columns = slide.locator("main section");
      const leftBox = await columns.first().boundingBox();
      const rightBox = await columns.nth(1).boundingBox();
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();
      expect(rightBox!.x).toBeGreaterThan(leftBox!.x + leftBox!.width);
      expect(
        await slide.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        })
      ).toEqual(
        orientation === "portrait"
          ? { height: 1920, width: 1080 }
          : { height: 1080, width: 1920 }
      );

      const productWithPhoto = slide.locator("main article").first();
      const productWithoutPhoto = slide.locator("main article").nth(1);
      const anchoredLayout = async (product: typeof productWithPhoto) => {
        const productBox = await product.boundingBox();
        const mediaBox = await product.locator("span").first().boundingBox();
        const copyBox = await product.locator("span").nth(1).boundingBox();
        const priceBox = await product.locator("b").boundingBox();
        expect(productBox).not.toBeNull();
        expect(mediaBox).not.toBeNull();
        expect(copyBox).not.toBeNull();
        expect(priceBox).not.toBeNull();
        return {
          copyX: copyBox!.x - productBox!.x,
          height: productBox!.height,
          mediaWidth: mediaBox!.width,
          priceRight:
            productBox!.x + productBox!.width - priceBox!.x - priceBox!.width
        };
      };
      await expect(productWithPhoto.locator("img")).toHaveCount(1);
      await expect(productWithoutPhoto.locator("img")).toHaveCount(0);
      expect(await anchoredLayout(productWithoutPhoto)).toEqual(
        await anchoredLayout(productWithPhoto)
      );

      if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
        await page.screenshot({
          path: `docs/screenshots/s103-editorial-arena-price-list-${theme}-${orientation}.png`
        });
      }
    });
  }
}
