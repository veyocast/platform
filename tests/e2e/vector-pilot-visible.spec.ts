import { expect, test } from "@playwright/test";

test.describe("Fieldflow shell and screen views", () => {
  test("shows one shell, one navigation and an honest operational state", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/dashboard");

    await expect(page.locator(".control-shell")).toBeVisible();
    await expect(page.locator(".control-sidebar")).toHaveCount(1);
    await expect(page.locator(".vector-context-rail")).toHaveCount(0);
    await expect(page.getByText("Operational cockpit", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Schermen online", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nog niets actief" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", {
        name: "Schermgroepen"
      })
    ).toHaveCount(0);

    await page.goto("/dashboard/screens");
    const views = page.getByRole("navigation", {
      name: "Weergave van de schermvloot"
    });
    await expect(views).toBeVisible();
    await expect(views.getByRole("link", { name: "Schermgroepen" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Venue Twin" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Gezondheid" })).toBeVisible();
    await views.getByRole("link", { name: "Venue Twin" }).click();
    await expect(
      page.getByRole("heading", { name: "Leg eerst de echte venue vast" })
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("keeps the Fieldflow views usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/dashboard/screens");

    await expect(page.locator(".vector-context-rail")).toHaveCount(0);
    const views = page.getByRole("navigation", {
      name: "Weergave van de schermvloot"
    });
    await expect(views).toBeVisible();
    await expect(views.getByRole("link", { name: "Schermgroepen" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Venue Twin" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Gezondheid" })).toBeVisible();
    await views.getByRole("link", { name: "Venue Twin" }).click();
    await expect(
      page.getByRole("heading", { name: "Leg eerst de echte venue vast" })
    ).toBeVisible();
  });
});
