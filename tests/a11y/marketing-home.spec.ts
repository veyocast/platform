import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("marketing homepage exposes navigation, sections and CTA landmarks", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(
    page.getByRole("navigation", { name: "Pagina" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "VeyoCast" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gebouwd rond echte schermoperatie." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Een vaste route van upload naar scherm." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eerst lokaal betrouwbaar, daarna pas opschalen." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start pilotcheck" })).toBeVisible();
});
