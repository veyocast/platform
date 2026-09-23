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
      await page.clock.setFixedTime(new Date("2026-09-09T12:00:00.000Z"));
      await routeEditorialPriceListManifest(page, playerURL, orientation, theme);
      await page.goto(`${playerURL}/?deviceToken=demo-online`);

      const slide = page.getByLabel("Dynamische prijslijst");
      await expect(slide).toBeVisible();
      await expect(slide).toHaveAttribute("data-orientation", orientation);
      await expect(slide).toHaveAttribute("data-theme", theme);
      await expect(slide).toHaveAttribute("data-design-revision", "royal-current-v8");
      await expect(slide.locator("header h1")).toHaveText("Prijslijst");
      await expect(slide.locator("header")).toContainText("In de kantine");
      await expect(slide.locator("header")).toContainText("Duindorp sv");
      await expect(slide.locator("header time")).toHaveText("09-09-2026 | 14:00");
      await expect(slide.locator("header img")).toHaveCount(1);
      await expect(slide.locator("footer")).toContainText("Prijzen uit de clubkantine");
      await expect(slide.locator("footer [aria-label^='Pagina']")).toHaveAttribute(
        "aria-label",
        `Pagina 1 van ${orientation === "portrait" ? 1 : 2}`
      );
      await expect(page.getByRole("region", { name: "Linkerkolom" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Rechterkolom" })).toBeVisible();
      await expect(page.getByText("Dranken", { exact: true })).toBeVisible();
      await expect(page.getByText("Warme snacks", { exact: true })).toBeVisible();
      await expect(slide.locator("canvas")).toHaveCount(0);
      expect(await slide.locator("main article").count()).toBe(
        orientation === "portrait" ? 32 : 16
      );

      const leftBox = await page.getByRole("region", { name: "Linkerkolom" }).boundingBox();
      const rightBox = await page.getByRole("region", { name: "Rechterkolom" }).boundingBox();
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();
      expect(rightBox!.y).toBeGreaterThan(leftBox!.y);
      const tableBox = await slide.locator("main > div > section").boundingBox();
      const featureBox = await slide.locator("main aside").boundingBox();
      expect(tableBox).not.toBeNull();
      expect(featureBox).not.toBeNull();
      if (orientation === "portrait") {
        expect(featureBox!.y).toBeGreaterThanOrEqual(tableBox!.y + tableBox!.height - 1);
      } else {
        expect(featureBox!.x).toBeGreaterThanOrEqual(tableBox!.x + tableBox!.width - 1);
      }
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
        expect(mediaBox).toBeNull();
        expect(copyBox).not.toBeNull();
        expect(priceBox).not.toBeNull();
        return {
          copyX: copyBox!.x - productBox!.x,
          height: productBox!.height,
          priceRight:
            productBox!.x + productBox!.width - priceBox!.x - priceBox!.width
        };
      };
      await expect(productWithPhoto.locator("img")).toHaveCount(1);
      await expect(productWithoutPhoto.locator("img")).toHaveCount(0);
      expect(await anchoredLayout(productWithoutPhoto)).toEqual(
        await anchoredLayout(productWithPhoto)
      );

      const productTitles = slide.locator("main article strong");
      await expect(productTitles.nth(0)).toHaveAttribute("data-title-density", "default");
      await expect(productTitles.nth(1)).toHaveAttribute("data-title-density", "compact");
      await expect(productTitles.nth(2)).toHaveAttribute("data-title-density", "dense");
      expect(await productTitles.evaluateAll((titles) => titles.slice(0, 3).map(
        (title) => getComputedStyle(title).fontSize
      ))).toEqual(
        orientation === "portrait"
          ? ["27px", "27px", "27px"]
          : ["29px", "29px", "29px"]
      );

      if (orientation === "portrait") {
        const gutters = await slide.evaluate((element) => {
          const root = element.getBoundingClientRect();
          return [":scope > header", ":scope > main", ":scope > footer"].map((selector) => {
            const box = element.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
            return { left: box.left - root.left, right: root.right - box.right };
          });
        });
        expect(gutters.every(({ left, right }) => Math.abs(left - right) < 1)).toBe(true);
      }

      if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
        await page.screenshot({
          path: `docs/screenshots/s187-royal-current-price-list-${theme}-${orientation}.png`
        });
      }
    });
  }
}
