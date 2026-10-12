import { expect, test, type Page } from "@playwright/test";

async function openControl(page: Page, path: string) {
  await expect(async () => {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await expect(page.locator("#control-content"), `${path} herstelt na de begrensde ontwikkelserverherstart`).toBeVisible();
  }).toPass({ timeout: 90_000 });
}


test.describe("Fieldflow shell and screen views", () => {
  test.setTimeout(180_000);
  test("shows one shell, one navigation and an honest operational state", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await openControl(page, "/dashboard");

    await expect(page.locator(".sites-control.vx-shell")).toBeVisible();
    await expect(page.locator("#control-sidebar-navigation.vx-sidebar")).toHaveCount(1);
    await expect(page.locator(".vector-context-rail")).toHaveCount(0);
    await expect(page.getByText("Operational cockpit", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Schermen online", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nog niets actief" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", {
        name: "Schermgroepen"
      })
    ).toHaveCount(0);

    await openControl(page, "/dashboard/screens");
    const views = page.getByRole("navigation", {
      name: "Weergave van de schermvloot"
    });
    await expect(views).toBeVisible();
    await expect(views.getByRole("link", { name: "Schermgroepen" })).toBeVisible();
    // Without an authenticated tenant feature grant, both advanced views
    // stay hidden and direct navigation explains the actual server gate.
    await expect(views.getByRole("link", { name: "Venue Twin" })).toHaveCount(0);
    await expect(views.getByRole("link", { name: "Gezondheid" })).toHaveCount(0);
    await openControl(page, "/dashboard/screens?view=venue");
    await expect(
      page.getByRole("heading", { name: "Venue Twin staat voor deze organisatie uit" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Venue toevoegen" })).toHaveCount(0);
    const bounds = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);

    expect(errors).toEqual([]);
  });

  test("keeps the Fieldflow views usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await openControl(page, "/dashboard/screens");

    await expect(page.locator(".vector-context-rail")).toHaveCount(0);
    const views = page.getByRole("navigation", {
      name: "Weergave van de schermvloot"
    });
    await expect(views).toBeVisible();
    await expect(views.getByRole("link", { name: "Schermgroepen" })).toBeVisible();
    // Without an authenticated tenant feature grant, both advanced views
    // stay hidden and direct navigation explains the actual server gate.
    await expect(views.getByRole("link", { name: "Venue Twin" })).toHaveCount(0);
    await expect(views.getByRole("link", { name: "Gezondheid" })).toHaveCount(0);
    await openControl(page, "/dashboard/screens?view=venue");
    await expect(
      page.getByRole("heading", { name: "Venue Twin staat voor deze organisatie uit" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Venue toevoegen" })).toHaveCount(0);
    const bounds = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);
  });
});
