import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("renders the marketing homepage with canon-safe messaging", async ({ page }) => {
  await page.goto(marketingURL);

  await expect(page).toHaveTitle(
    "ClubTV en narrowcasting voor sportverenigingen | VeyoCast"
  );
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Breng jouw club tot leven op ieder scherm."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan een demo" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Bekijk VeyoCast" })).toBeVisible();
  await expect(page.getByText("Immutable releases", { exact: true })).toBeVisible();
  await expect(page.getByText("Last-known-good", { exact: true })).toBeVisible();
  await expect(page.getByText("Server-side bevoegdheden", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Bekijk VeyoCast" }).click();
  await expect(page).toHaveURL(/\/product$/);
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Alles voor narrowcasting in één gebruiksvriendelijk platform"
    })
  ).toBeVisible();
});
