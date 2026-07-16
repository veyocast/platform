import { expect, test } from "@playwright/test";

test("renders the control shell with role-aware navigation", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const roles = page.getByLabel("Actieve rollen");
  await expect(roles.getByText("Tenantadmin")).toBeVisible();
  await expect(roles.getByText("Platformadmin")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(nav.getByRole("link", { name: /Platform/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team/ })).toBeVisible();

  await nav.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
  await expect(page.getByRole("heading", { exact: true, name: "Media" })).toBeVisible();
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();

  await nav.getByRole("link", { name: /Tenants/ }).click();
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { exact: true, name: "Tenantbeheer" })
  ).toBeVisible();
  await expect(page.getByText("Platformadmin vereist")).toBeVisible();

  await nav.getByRole("link", { name: /Auditlog/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/auditlog$/);
  await expect(page.getByRole("heading", { name: "Auditlog" })).toBeVisible();
});

test("supports the public login and auth callback routes", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij Castivo Control" })
  ).toBeVisible();

  await page.getByLabel("E-mailadres").fill("operator@castivo.test");
  await page.getByRole("button", { name: "Doorgaan" }).click();

  await expect(page).toHaveURL(/\/auth\/callback/);
  await expect(
    page.getByRole("heading", { name: "Sessiecontrole voorbereid" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Naar dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
