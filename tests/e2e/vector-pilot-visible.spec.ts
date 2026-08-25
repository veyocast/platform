import { expect, test } from "@playwright/test";

test.describe("Vector pilot is visibly discoverable", () => {
  test("shows the Vector shell, System Pulse and explicit fleet views", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/dashboard");
    await expect(page.locator('[data-vector="enabled"]')).toBeVisible();
    await expect(page.getByText("Living Venue OS", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "System Pulse wacht op live data" })).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/vector-v2/control/system-pulse-1440x900.png"
    });

    await page.goto("/dashboard/screens");
    await expect(page.getByRole("navigation", { name: "Weergave van de schermvloot" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Venue Twin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gezondheid" })).toBeVisible();
    await page.getByRole("link", { name: "Venue Twin" }).click();
    await expect(page.getByRole("heading", { name: "Leg eerst de echte venue vast" })).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/vector-v2/control/venue-setup-1440x900.png"
    });

    expect(errors).toEqual([]);
  });

  test("keeps the pilot entry points usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/dashboard/screens");
    const views = page.getByRole("navigation", { name: "Weergave van de schermvloot" });
    await expect(views).toBeVisible();
    await expect(views.getByRole("link", { name: "Venue Twin" })).toBeVisible();
    await expect(views.getByRole("link", { name: "Gezondheid" })).toBeVisible();
    await views.getByRole("link", { name: "Venue Twin" }).click();
    await expect(page.getByRole("heading", { name: "Leg eerst de echte venue vast" })).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/vector-v2/control/venue-setup-390x844.png"
    });
  });
});
