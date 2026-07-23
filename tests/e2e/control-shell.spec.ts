import { expect, test } from "@playwright/test";

test("renders the control shell with role-aware navigation", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Welkom, Daan Operator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verbind een live omgeving voor operationeel inzicht" })).toBeVisible();
  await expect(page.getByText("Veilige lege staat")).toBeVisible();
  await expect(page.getByText("Bestuurskamer")).toHaveCount(0);
  await expect(
    page.locator("summary").filter({ hasText: "Museumkwartier" })
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(nav.getByRole("link", { name: /Platform/ })).toHaveCount(0);
  await expect(nav.getByText("Verenigingscontext")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Playlists/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Releases/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Schermen/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team/ })).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Overzicht" }).first()).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Content" })).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Distributie" })).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Organisatie" }).first()).toBeVisible();
  await expect(nav.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);

  await nav.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Media" })
  ).toBeVisible();
  await page.getByText("Upload- en verwerkingsregels", { exact: true }).click();
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veilige verwerking" })).toBeVisible();

  await nav.getByRole("link", { name: /Playlists/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/playlists$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nieuwe playlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Playlistlijst" })).toBeVisible();

  await nav.getByRole("link", { name: /Releases/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/releases$/);
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Release Center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Immutable historie" })).toBeVisible();
  await expect(page.getByText("Nog geen releases")).toBeVisible();

  await nav.getByRole("link", { name: /Schermen/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schermvloot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toBeVisible();

  await page.getByRole("link", { name: "Scherm toevoegen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens\/new$/);
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Scherm toevoegen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schermdetails en eerste content" })).toBeVisible();

  await page.locator("summary").filter({ hasText: "Museumkwartier" }).click();
  await page.getByRole("button", { name: /VeyoCast platform/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await expect(nav.getByText("Platformcontext")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toHaveCount(0);
  await nav.getByRole("link", { name: /Tenants/ }).click();
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Tenantbeheer" })
  ).toBeVisible();
  await expect(page.getByText("Demodata", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nieuwe vereniging" })
  ).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Technische slug")).toBeVisible();
  await expect(page.getByLabel("Schermlimiet")).toHaveValue("4");
  await expect(
    page.getByRole("button", { name: "Vereniging aanmaken" })
  ).toBeDisabled();

  await page.goto("/dashboard/auditlog");
  await nav.getByRole("link", { name: /Auditlog/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/auditlog$/);
  await expect(page.getByRole("heading", { name: "Auditlog" })).toBeVisible();
});

test("persists theme and density preferences without a color flash", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Thema en dichtheid: Systeem" }).click();
  await page.getByRole("radio", { name: "Donker" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".control-brand__logo--inverse")).toBeVisible();

  await page.getByRole("button", { name: "Thema en dichtheid: Donker" }).click();
  await page.getByRole("radio", { name: "Compact" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("supports the public login and auth callback routes", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij VeyoCast Control" })
  ).toBeVisible();
  await expect(page.getByText("Lokale demoomgeving")).toBeVisible();
  await expect(page.getByText("http://localhost:3000")).toHaveCount(0);

  await page.getByLabel("E-mailadres").fill("operator@veyocast.test");
  await page.getByRole("button", { name: "Doorgaan" }).click();

  await expect(page).toHaveURL(/\/auth\/callback/);
  await expect(
    page.getByRole("heading", { name: "Sessiecontrole voorbereid" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Naar dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const invalidConfirmation = await page.request.get(
    "/auth/confirm?next=https://example.invalid",
    { maxRedirects: 0 }
  );
  expect(invalidConfirmation.status()).toBe(307);
  const confirmationRedirect = new URL(invalidConfirmation.headers().location);
  expect(`${confirmationRedirect.pathname}${confirmationRedirect.search}`).toBe(
    "/login?fout=inloggen"
  );
});

test("collapses to an icon rail and always exposes the desktop restore control", async ({
  page
}) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.evaluate(() => {
    window.localStorage.setItem("veyocast-control-sidebar-collapsed", "true");
  });
  await page.reload();

  const sidebar = page.getByLabel("Control navigatie");
  const expandButton = page.getByRole("button", {
    name: "Navigatie uitklappen"
  });
  await expect(expandButton).toBeVisible();
  await expect(expandButton).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveCSS("width", "72px");
  await expect(
    sidebar.getByRole("link", { exact: true, name: "Dashboard" })
  ).toBeVisible();
  await expect(sidebar.getByText("Dagelijkse operatie en aandachtspunten")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  await expandButton.click();
  const collapseButton = page.getByRole("button", {
    name: "Navigatie inklappen"
  });
  await expect(collapseButton).toBeVisible();
  await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).toHaveCSS("width", "248px");
  await expect(
    sidebar.getByText("Dagelijkse operatie en aandachtspunten")
  ).toBeVisible();

  await collapseButton.click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Navigatie uitklappen" })
  ).toBeVisible();
});

test("keeps the sidebar logo fixed while navigation and content scroll independently", async ({
  page
}) => {
  await page.setViewportSize({ height: 480, width: 1280 });
  await page.goto("/dashboard/media");

  const sidebar = page.getByLabel("Control navigatie");
  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  const main = page.getByRole("main");
  const brand = sidebar.locator(".control-brand");
  const brandBefore = await brand.boundingBox();

  await expect(sidebar).toHaveCSS("overflow", "hidden");
  await expect(navigation).toHaveCSS("overflow-y", "auto");
  await expect(main).toHaveCSS("overflow-y", "auto");

  await main.evaluate((element) => element.scrollTo({ top: 900 }));
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const brandAfterMainScroll = await brand.boundingBox();
  expect(brandAfterMainScroll?.y).toBe(brandBefore?.y);

  const navCanScroll = await navigation.evaluate(
    (element) => element.scrollHeight > element.clientHeight
  );
  expect(navCanScroll).toBe(true);
  await navigation.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  expect(await navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const brandAfterNavScroll = await brand.boundingBox();
  expect(brandAfterNavScroll?.y).toBe(brandBefore?.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("supports command navigation and the compact mobile navigation flow", async ({
  page
}) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Snel naar een onderdeel" }).click();
  const commandPalette = page.getByRole("dialog", { name: "Snel naar een onderdeel" });
  await expect(commandPalette).toBeVisible();
  await commandPalette
    .getByPlaceholder("Zoek schermen, media, playlists of releases")
    .fill("Schermen");
  await commandPalette.getByRole("link", { name: /Schermen/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/screens$/);

  await page.setViewportSize({ height: 844, width: 390 });
  const topbar = page.getByLabel("Control status");
  const menuButton = page.getByRole("button", { name: "Navigatie openen" });
  const searchButton = page.getByRole("button", { name: "Snel naar een onderdeel" });

  await expect(topbar).toHaveCSS("min-height", "64px");
  await Promise.all([
    expect(menuButton).toBeVisible(),
    expect(searchButton).toBeVisible(),
    expect(page.getByRole("button", { name: "Open actiepunten" })).toHaveCount(0),
    expect(page.getByRole("link", { name: "Nieuwe playlist" })).toHaveCount(0)
  ]);

  const [menuBox, searchBox, topbarBox] = await Promise.all([
    menuButton.boundingBox(),
    searchButton.boundingBox(),
    topbar.boundingBox()
  ]);

  expect(menuBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  expect(menuBox!.x).toBeLessThan(searchBox!.x);
  expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(
    topbarBox!.y + topbarBox!.height
  );

  await menuButton.click();

  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: /Media/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
});
