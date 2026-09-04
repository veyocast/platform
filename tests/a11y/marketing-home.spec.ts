import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("marketing homepage exposes navigation, sections and CTA landmarks", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("navigation", { exact: true, name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Van clubverhaal naar ieder scherm."
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Je boodschap vindt vanzelf de juiste weg." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Direct zien wat er speelt." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ieder moment voelt als maatwerk." })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Naar de inhoud" })).toBeAttached();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
