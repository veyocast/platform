import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("marketing homepage exposes navigation, sections and CTA landmarks", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("navigation", { exact: true, name: "Publieke hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Maak van ieder scherm een verhaal."
    })
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Direct naar inhoud" })).toBeAttached();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
