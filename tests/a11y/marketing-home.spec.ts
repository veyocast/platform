import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("marketing homepage exposes navigation, sections and CTA landmarks", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Breng jouw club tot leven op ieder scherm."
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Van idee naar ieder scherm, zonder gedoe." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publiceren met overzicht en controle." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blijft spelen. Ook als internet even niet meewerkt." })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Naar de inhoud" })).toBeAttached();
});
