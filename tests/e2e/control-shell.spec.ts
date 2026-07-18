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
  await expect(page.getByText("Demomodus zonder mutaties")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nieuwe playlist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicatietijdlijn" })).toBeVisible();

  await nav.getByRole("link", { name: /Schermen/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByText("Demomodus zonder mutaties")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scherm aanmaken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player koppelen" })).toBeVisible();

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
    page.getByRole("heading", { name: "Inloggen bij VeyoCast Control" })
  ).toBeVisible();

  await page.getByLabel("E-mailadres").fill("operator@veyocast.test");
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
  const topbar = page.getByLabel("Control status");
  const menuButton = page.getByRole("button", { name: "Navigatie openen" });
  const searchButton = page.getByRole("button", { name: "Zoeken in Control" });
  const notificationsButton = page.getByRole("button", { name: "Open actiepunten" });
  const createPlaylist = page.getByRole("link", { name: "Nieuwe playlist" }).first();

  await expect(topbar).toHaveCSS("min-height", "64px");
  await Promise.all([
    expect(menuButton).toBeVisible(),
    expect(searchButton).toBeVisible(),
    expect(notificationsButton).toBeVisible(),
    expect(createPlaylist).toBeVisible()
  ]);

  const [menuBox, searchBox, notificationsBox, createBox, topbarBox] = await Promise.all([
    menuButton.boundingBox(),
    searchButton.boundingBox(),
    notificationsButton.boundingBox(),
    createPlaylist.boundingBox(),
    topbar.boundingBox()
  ]);

  expect(menuBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(notificationsBox).not.toBeNull();
  expect(createBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  expect(menuBox!.x).toBeLessThan(searchBox!.x);
  expect(searchBox!.x).toBeLessThan(notificationsBox!.x);
  expect(notificationsBox!.x).toBeLessThan(createBox!.x);
  expect(createBox!.y + createBox!.height).toBeLessThanOrEqual(
    topbarBox!.y + topbarBox!.height
  );

  await menuButton.click();

  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
});
