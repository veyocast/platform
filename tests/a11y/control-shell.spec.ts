import { expect, test } from "@playwright/test";

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("public auth routes have clear headings and forms", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij Castivo Control" })
  ).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Tenant")).toBeVisible();

  await page.goto("/accept-invite");
  await expect(page.getByRole("heading", { name: "Invite accepteren" })).toBeVisible();
  await expect(page.getByLabel("Invitecode")).toBeVisible();
});
