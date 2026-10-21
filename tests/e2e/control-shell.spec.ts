import { expect, test, type Locator, type Page } from "@playwright/test";

async function follow(
  page: Page,
  target: () => Locator,
  destination: RegExp
) {
  if (destination.test(page.url())) return;
  const link = target();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(destination, {timeout: 30_000});
}

async function openFromCommand(
  page: Page,
  label: string,
  destination: RegExp
) {
  if (destination.test(page.url())) return;
  const dialog = page.getByRole("dialog", { name: "Snel naar een onderdeel" });
  if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Snel naar een onderdeel" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Zoek navigatie en resources").fill(label);
  await dialog.getByRole("link").filter({has: page.getByText(label, {exact: true})}).first().click();
  await expect(page).toHaveURL(destination, {timeout: 30_000});
}

test("renders the Sync shell with role-aware navigation", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({height: 900, width: 1280});
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Mooi dat je er bent,/ })).toBeVisible();
  await expect(page.getByText("De club in beeld. Jij houdt het overzicht.")).toBeVisible();
  await expect(page.getByText("Nog geen bevestigde inhoud", { exact: true })).toBeVisible();
  await expect(page.getByText("Bestuurskamer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actieve context: Museumkwartier" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(nav.getByRole("link")).toHaveText(["Overzicht", "Content", "Playlists", "Planning", "Schermen"]);
  await expect(nav.getByRole("link", { name: /Platform/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
  const manage = page.getByRole("navigation", { name: "Beheer", exact: true });
  await expect(manage.getByRole("link")).toHaveText(["Bronnen", "Producten", "Thema’s", "Sponsors", "Interactie", "Team & rechten", "Support", "Abonnement"]);
  await page.setViewportSize({height: 900, width: 1024});
  await page.getByLabel("Control navigatie").getByRole("button", {name: "Beheer", exact: true}).click();
  const management = page.getByRole("dialog", {name: "Beheer je werkplek", exact: true});
  await expect(management.getByRole("link", {name: "Media", exact: true})).toHaveAttribute("href", "/dashboard/media");
  await expect(management.getByRole("link", {name: "Menu Studio", exact: true})).toHaveAttribute("href", "/dashboard/slides/menu-studio");
  await expect(management.getByRole("link", {name: "Publicaties", exact: true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(management).not.toBeVisible();
  await expect(page.getByLabel("Control navigatie").getByRole("button", {name: "Beheer", exact: true})).toBeFocused();

  await page.setViewportSize({height: 900, width: 1280});
  await openFromCommand(page, "Sponsor Hub", /\/dashboard\/sponsors$/);
  await expect(page.getByRole("heading", {exact: true, level: 1, name: "Geef je partners een podium."})).toBeVisible();
  const sponsorTabs = page.getByRole("tablist", {name: "Sponsoronderdelen", exact: true});
  await expect(sponsorTabs.getByRole("tab")).toHaveText(["Campagnes", "Partners", "Pipeline & taken", "Afspeelregistratie"]);
  await expect(sponsorTabs.getByRole("tab", {name: "Campagnes", exact: true})).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", {name: "Campagnes", exact: true})).toBeVisible();
  for (const label of ["Clubpartners", "Actieve campagnes", "Gemelde afspeelbeurten"]) {
    await expect(page.getByText(label, {exact: true})).toBeVisible();
  }
  const sponsorSettings = page.getByRole("button", {name: "Publicatie en posities", exact: true});
  await sponsorSettings.click();
  const sponsorDialog = page.getByRole("dialog", {name: "Publicatie en posities", exact: true});
  await expect(sponsorDialog.getByRole("heading", {name: "Publicatie", exact: true})).toBeVisible();
  await expect(sponsorDialog.getByRole("heading", {name: "Beschikbare posities", exact: true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sponsorDialog).not.toBeVisible();
  await expect(sponsorSettings).toBeFocused();
  await expect(page.getByRole("heading", {exact: true, name: "Je eerste partnerverhaal begint hier"})).toBeVisible();

  await follow(page, () => nav.getByRole("link", {name: "Content", exact: true}), /\/dashboard\/content$/);
  await expect(page.getByRole("heading", {exact: true, level: 1, name: "Contentbibliotheek"})).toBeVisible();
  await openFromCommand(page, "Media", /\/dashboard\/media$/);
  await expect(page.getByRole("heading", {exact: true, level: 1, name: "Media"})).toBeVisible();
  await page.getByText("Upload- en verwerkingsregels", {exact: true}).click();
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();
  await expect(page.getByRole("heading", {name: "Veilige verwerking"})).toBeVisible();

  await openFromCommand(page, "Playlists", /\/dashboard\/playlists$/);
  await expect(page.locator("#control-content").getByRole("heading", {name: "Je playlists", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Nieuwe playlist"})).toHaveCount(0);
  await expect(nav.getByRole("link", {name: "Playlists", exact: true})).toHaveAttribute("aria-current", "page");

  await follow(page, () => manage.getByRole("link", {name: "Bronnen", exact: true}), /\/dashboard\/sources$/);
  await expect(page.getByRole("heading", {level: 1, name: "Alles begint bij goede gegevens."})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Nog geen bronnen verbonden"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Bron toevoegen", exact: true})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Bron toevoegen", exact: true})).toHaveCount(0);
  await page.goto("/dashboard/sources/twelve/products");
  await expect(page.getByRole("heading", {level: 1, name: "Een frisse kaart voor je club."})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Geen producten gevonden"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Product toevoegen", exact: true})).toBeDisabled();

  await openFromCommand(page, "Publicaties", /\/dashboard\/publications$/);
  await expect(page.getByRole("heading", {exact: true, level: 1, name: "Publicaties"})).toBeVisible();
  await expect(page.getByRole("heading", {exact: true, name: "Gepubliceerd"})).toBeVisible();
  await expect(page.getByText(/live gegevens verversen zelfstandig/i)).toBeVisible();
  await expect(page.getByText("Nog geen publicaties")).toBeVisible();

  await follow(page, () => nav.getByRole("link", {name: "Schermen", exact: true}), /\/dashboard\/screens$/);
  await expect(page.getByRole("heading", {level: 1, name: "Jouw club. Overal in beeld."})).toBeVisible();
  await expect(page.locator(".px-screen-card")).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Scherm koppelen", exact: true})).toBeDisabled();
  await page.goto("/dashboard/screens/new");
  await expect(page.locator("h1").filter({hasText: "Een scherm toevoegen"})).toHaveCount(1);
  const setup = page.getByRole("dialog", {name: "Een scherm toevoegen"});
  await expect(setup).toBeVisible();
  await expect(setup.getByRole("heading", {name: "Open VeyoCast op je scherm", exact: true})).toBeVisible();
  await expect(setup.getByRole("group", {name: "Installatie-instructie voor je Player"}).getByRole("button")).toHaveText(["Android", "LG webOS", "Web"]);
  await expect(setup.getByLabel("Schermnaam", {exact: true})).toHaveCount(0);
  await expect(setup.locator("form")).toHaveCount(0);
  await expect(setup.getByRole("button", {name: "Ik heb een koppelcode", exact: true})).toBeDisabled();
  await expect(setup.getByRole("status").filter({hasText: "Er wordt niets aangemaakt"})).toContainText("Er wordt niets aangemaakt");
  await setup.getByRole("button", {name: "Scherm instellen sluiten", exact: true}).click();
  await expect(setup).not.toBeVisible();

  await expect(async () => {
    if (/\/platform$/.test(page.url())) return;
    await page.getByRole("button", {name: "Actieve context: Museumkwartier"}).click();
    await page.getByRole("button", {name: /VeyoCast platform/}).click();
    await expect(page).toHaveURL(/\/platform$/);
  }).toPass({timeout: 20_000});
  await expect(page.locator(".sites-control")).toHaveAttribute("data-navigation-scope", "platform");
  await expect(nav.getByRole("link", {name: "Content", exact: true})).toHaveCount(0);
  await follow(page, () => nav.getByRole("link", {name: /Klanten/}), /\/platform\/tenants$/);
  await expect(page.getByRole("heading", {exact: true, level: 1, name: "Tenantbeheer"})).toBeVisible();
  await expect(page.getByText("Demodata", {exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Nieuwe vereniging"})).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Technische slug")).toBeVisible();
  await expect(page.getByLabel("Schermlimiet")).toHaveValue("4");
  await expect(page.getByRole("button", {name: "Vereniging aanmaken"})).toBeDisabled();

  await page.goto("/dashboard/auditlog");
  await expect(page).toHaveURL(/\/dashboard\/activity$/);
  await page.setViewportSize({height: 900, width: 1024});
  await page.getByLabel("Control navigatie").getByRole("button", {name: "Beheer", exact: true}).click();
  await expect(page.getByRole("dialog", {name: "Beheer je werkplek", exact: true}).getByRole("link", {name: "Activiteit", exact: true})).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", {name: "Activiteit"})).toBeVisible();
});

test("persists theme and density preferences without a color flash", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dashboard");

  const dialog = page.getByRole("dialog", { name: "Weergave aanpassen" });
  const trigger = page.getByRole("button", {
    name: /Thema en dichtheid: (Systeem|Donker)/
  });
  const accountTrigger = page.getByRole("button", { name: "Accountmenu openen" });
  await expect(async () => {
    const storedTheme = await page.evaluate(() =>
      window.localStorage.getItem("veyocast-control-theme")
    );
    if (storedTheme !== "dark") {
      if (!(await trigger.isVisible())) await accountTrigger.click();
      if (!(await dialog.isVisible())) await trigger.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("radio", { name: "Donker" }).click();
    }
    await expect.poll(() =>
      page.evaluate(() => window.localStorage.getItem("veyocast-control-theme"))
    ).toBe("dark");
  }).toPass({ timeout: 30_000 });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".vx-brand img")).toBeVisible();

  await expect(async () => {
    const storedDensity = await page.evaluate(() =>
      window.localStorage.getItem("veyocast-control-density")
    );
    if (storedDensity !== "compact") {
      if (!(await trigger.isVisible())) await accountTrigger.click();
      if (!(await dialog.isVisible())) {
        await page.getByRole("button", { name: "Thema en dichtheid: Donker" }).click();
      }
      await expect(dialog).toBeVisible();
      await dialog.getByRole("radio", { name: "Compact" }).click();
    }
    await expect.poll(() =>
      page.evaluate(() => window.localStorage.getItem("veyocast-control-density"))
    ).toBe("compact");
  }).toPass({ timeout: 30_000 });
  await expect(dialog).not.toBeVisible();
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

  await expect(async () => {
    if (/\/auth\/callback/.test(page.url())) return;
    await page.getByLabel("E-mailadres").fill("operator@veyocast.test");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/auth\/callback/);
  }).toPass({ timeout: 45_000 });
  await expect(
    page.getByRole("heading", { name: "Sessiecontrole voorbereid" })
  ).toBeVisible();

  await follow(
    page,
    () => page.getByRole("link", { name: "Naar dashboard" }),
    /\/dashboard$/
  );

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

test("preserves the fixed Sync sidebar across reload and legacy collapse preferences", async ({
  page
}) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.localStorage.setItem("veyocast-control-sidebar-collapsed", "true");
  });
  await page.reload();

  const sidebar = page.getByLabel("Control navigatie");
  await expect(sidebar).toHaveCSS("width", "228px");
  await expect(sidebar.getByRole("link", {name: "Overzicht", exact: true})).toBeVisible();
  await expect(sidebar.locator(".vx-brand img")).toBeVisible();
  await expect(page.getByRole("button", {name: /Navigatie (in|uit)klappen/})).toHaveCount(0);
  await page.setViewportSize({height: 900, width: 1024});
  await expect(sidebar).toHaveCSS("width", "205px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("keeps the Sites sidebar and content scrolling independently", async ({
  page
}) => {
  await page.setViewportSize({ height: 480, width: 1280 });
  await page.goto("/dashboard/pilot");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Pilotflow" })
  ).toBeVisible();

  const sidebar = page.getByLabel("Control navigatie");
  const navigation = page.getByRole("navigation", {
    exact: true,
    name: "Hoofdnavigatie"
  });
  await expect(navigation).toBeVisible();
  const scrollableNavigation = sidebar;
  const main = page.getByRole("main");
  const brand = sidebar.locator(".vx-brand");
  await expect(brand).toBeVisible();
  await expect.poll(async () => (await brand.boundingBox())?.y).toBe(27);
  const brandBeforeY = (await brand.boundingBox())?.y;

  await expect(sidebar).toHaveCSS("overflow-y", "auto");
  await expect(scrollableNavigation).toHaveCSS("overflow-y", "auto");
  await expect(main).toHaveCSS("overflow-y", "auto");
  await main.evaluate((element) => {
    const content = element.querySelector<HTMLElement>("#control-content");
    if (content) content.style.minHeight = "1400px";
  });

  await main.evaluate((element) => element.scrollTo({ top: 900 }));
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await brand.boundingBox())?.y).toBe(brandBeforeY);

  const navCanScroll = await scrollableNavigation.evaluate(
    (element) => element.scrollHeight > element.clientHeight
  );
  expect(navCanScroll).toBe(true);
  await scrollableNavigation.evaluate((element) =>
    element.scrollTo({ top: element.scrollHeight })
  );
  expect(
    await scrollableNavigation.evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(0);
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("keeps the complete mobile page reachable above the fixed navigation", async ({
  page
}) => {
  await page.setViewportSize({ height: 640, width: 390 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const main = page.getByRole("main");
  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobiele hoofdnavigatie"
  });

  await expect(async () => {
    const metrics = await main.evaluate((element) => {
      const contentElement = element.querySelector<HTMLElement>(
        "#control-content"
      );
      const navigationElement = document.querySelector<HTMLElement>(
        ".vx-bottomnav"
      );
      const pageElement = contentElement?.firstElementChild as HTMLElement | null;
      if (!contentElement || !navigationElement || !pageElement) return null;

      pageElement.style.minHeight = "1800px";
      const contentClientHeight = contentElement.clientHeight;
      const contentScrollHeight = contentElement.scrollHeight;
      const canScroll = element.scrollHeight > element.clientHeight;
      element.scrollTop = element.scrollHeight;

      const pageBox = pageElement.getBoundingClientRect();
      const navigationBox = navigationElement.getBoundingClientRect();
      return {
        canScroll,
        contentClientHeight,
        contentScrollHeight,
        navigationTop: navigationBox.top,
        pageBottom: pageBox.bottom
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.contentClientHeight).toBeGreaterThanOrEqual(
      metrics!.contentScrollHeight
    );
    expect(metrics!.canScroll).toBe(true);
    expect(metrics!.pageBottom).toBeLessThan(metrics!.navigationTop);
  }).toPass({ timeout: 45_000 });
  await expect(mobileNavigation).toBeVisible();
});

test("supports command navigation and the compact mobile navigation flow", async ({
  page
}) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  const screensWarmup = await page.request.get("/dashboard/screens");
  expect(screensWarmup.ok()).toBe(true);

  const commandButton = page.getByRole("button", {
    name: "Snel naar een onderdeel"
  });
  await expect(commandButton).toBeEnabled();
  await commandButton.click();
  const commandPalette = page.getByRole("dialog", { name: "Snel naar een onderdeel" });
  await expect(commandPalette).toBeVisible();
  await commandPalette
    .getByPlaceholder("Zoek schermen, media, playlists of releases")
    .fill("Schermen");
  await follow(
    page,
    () => commandPalette.locator('a[href="/dashboard/screens"]'),
    /\/dashboard\/screens$/
  );

  await page.setViewportSize({ height: 844, width: 390 });
  const topbar = page.getByLabel("Control status");
  const searchButton = page.getByRole("button", { name: "Snel naar een onderdeel" });
  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobiele hoofdnavigatie"
  });

  await expect(topbar).toHaveCSS("min-height", "65px");
  await Promise.all([
    expect(page.getByRole("button", { name: "Navigatie openen" })).toBeVisible(),
    expect(searchButton).not.toBeVisible(),
    expect(mobileNavigation).toBeVisible(),
    expect(
      mobileNavigation.getByRole("link", { name: "Schermen" })
    ).toHaveAttribute("aria-current", "page"),
    expect(page.getByRole("button", { name: "Open actiepunten" })).toHaveCount(0),
    expect(page.getByRole("link", { name: "Nieuwe playlist" })).toHaveCount(0)
  ]);

  const menuBox = await page.getByRole("button", { name: "Navigatie openen" }).boundingBox();
  expect(menuBox?.height).toBeGreaterThanOrEqual(44);
  expect(menuBox?.width).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", {name: "Navigatie openen"}).click();
  const navigation = page.getByRole("navigation", {name: "Hoofdnavigatie", exact: true});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", {name: "Content", exact: true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(page.getByRole("button", {name: "Navigatie openen"})).toBeFocused();
  await follow(page, () => mobileNavigation.getByRole("link", {name: "Content", exact: true}), /\/dashboard\/content$/);
  await expect(page.getByRole("heading", {name: "Contentbibliotheek", level: 1})).toBeVisible();

});
