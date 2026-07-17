import { expect, test } from "@playwright/test";

test("renders the control shell with role-aware navigation", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Goedemorgen, Daan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operationele lijn" })).toBeVisible();
  await expect(page.getByLabel("Operationele tenantflow")).toContainText(
    "Player synchroniseert"
  );
  await expect(
    page.getByRole("button", { name: "Actieve vereniging Museumkwartier" })
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(nav.getByRole("link", { name: /Platform/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Playlists/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Schermen/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team/ })).toBeVisible();

  await nav.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Media" })
  ).toBeVisible();
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline voortgang" })).toBeVisible();

  await nav.getByRole("link", { name: /Playlists/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/playlists$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(page.getByText("Publicatiereview actief")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicatietijdlijn" })).toBeVisible();

  await nav.getByRole("link", { name: /Schermen/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByText("Player is een apart apparaat")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playerdiagnostiek" })).toBeVisible();

  await nav.getByRole("link", { name: /Tenants/ }).click();
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Tenantbeheer" })
  ).toBeVisible();
  await expect(page.getByText("Platformbeheerder vereist")).toBeVisible();

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

test("supports command navigation and the compact mobile navigation flow", async ({
  page
}) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Zoeken in Control" }).click();
  const commandPalette = page.getByRole("dialog", { name: "Zoeken in Control" });
  await expect(commandPalette).toBeVisible();
  await commandPalette
    .getByPlaceholder("Zoek schermen, playlists, media of instellingen")
    .fill("Schermen");
  await commandPalette.getByRole("link", { name: /Schermen/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens$/);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("button", { name: "Navigatie openen" }).click();

  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
});
