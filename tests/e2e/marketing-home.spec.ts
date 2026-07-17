import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("renders the marketing homepage with canon-safe messaging", async ({ page }) => {
  await page.goto(marketingURL);

  await expect(page).toHaveTitle(/Castivo .* ClubTV/);
  await expect(page.getByRole("heading", { exact: true, name: "Castivo" })).toBeVisible();
  await expect(page.getByText("local-first platform voor ClubTV")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bekijk pilotpad" })).toBeVisible();

  await expect(page.getByText("Geen advertentienetwerk.")).toBeVisible();
  await expect(page.getByText("Geen mutable releases.")).toBeVisible();
  await expect(page.getByText("Geen Supabase Auth-user voor players.")).toBeVisible();

  await page.getByRole("link", { exact: true, name: "Pilotpad" }).click();
  await expect(page).toHaveURL(/#pilot$/);
  await expect(
    page.getByRole("heading", { name: "Van organisatie naar spelend scherm." })
  ).toBeVisible();
});
