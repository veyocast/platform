import { expect, test, type Locator, type Page } from "@playwright/test";

async function follow(
  page: Page,
  target: () => Locator,
  destination: RegExp
) {
  await expect(async () => {
    if (destination.test(page.url())) return;
    const link = target();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(destination);
  }).toPass({ timeout: 20_000 });
}

async function openFromCommand(
  page: Page,
  label: string,
  destination: RegExp
) {
  await expect(async () => {
    if (destination.test(page.url())) return;
    const dialog = page.getByRole("dialog", { name: "Snel naar een onderdeel" });
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: "Snel naar een onderdeel" }).click();
    }
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Zoek navigatie en resources").fill(label);
    await dialog.getByRole("link").filter({ hasText: label }).first().click();
    await expect(page).toHaveURL(destination);
  }).toPass({ timeout: 20_000 });
}

test("renders the control shell with role-aware navigation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: /Goedemorgen,/ })).toBeVisible();
  await expect(page.getByText("Van idee naar ieder scherm")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nog niets actief" })).toBeVisible();
  await expect(page.getByText("Bestuurskamer")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    })
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await expect(nav.getByRole("link", { name: /Platform/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Overzicht", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Sponsor Hub/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Playlists/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Bronnen/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Publicaties/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Schermen/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team/ })).toHaveCount(0);
  await expect(nav.locator(".control-nav").getByRole("link")).toHaveCount(5);
  await expect(nav.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);

  await openFromCommand(page, "Sponsor Hub", /\/dashboard\/sponsors$/);
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Sponsor Hub" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sponsor Hub onderdelen" })).toBeVisible();
  await expect(page.getByText("Campagnes wisselen zonder de playlist te bewerken.")).toBeVisible();

  await follow(
    page,
    () => nav.getByRole("link", { name: /Media/ }),
    /\/dashboard\/media$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Media" })
  ).toBeVisible();
  await page.getByText("Upload- en verwerkingsregels", { exact: true }).click();
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veilige verwerking" })).toBeVisible();

  await openFromCommand(page, "Playlists", /\/dashboard\/playlists$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(
    page.getByLabel("Control status").getByText("Demomodus", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nieuwe playlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Playlistoverzicht" })).toBeVisible();

  await openFromCommand(page, "Bronnen", /\/dashboard\/sources$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Databronnen" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Twelve-import" })).toBeVisible();
  await follow(
    page,
    () => page.getByRole("link", { name: "Twelve-import" }),
    /\/dashboard\/sources\/twelve\/products$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Twelve Producten" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nog geen producten" })).toBeVisible();

  await openFromCommand(page, "Publicaties", /\/dashboard\/publications$/);
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Publicaties" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Immutable historie" })).toBeVisible();
  await expect(page.getByText("Nog geen releases")).toBeVisible();

  await follow(
    page,
    () => nav.getByRole("link", { name: /Schermen/ }),
    /\/dashboard\/screens$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(
    page.getByLabel("Control status").getByText("Demomodus", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Schermen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toHaveCount(0);
  await page.goto("/dashboard/screens/new");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Scherm toevoegen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schermdetails en eerste content" })).toBeVisible();

  await expect(async () => {
    if (/\/platform$/.test(page.url())) return;
    await page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    }).click();
    await page.getByRole("button", { name: /VeyoCast platform/ }).click();
    await expect(page).toHaveURL(/\/platform$/);
  }).toPass({ timeout: 20_000 });
  await expect(nav.getByText("Platformcontext")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toHaveCount(0);
  await follow(
    page,
    () => nav.getByRole("link", { name: /Klanten/ }),
    /\/platform\/tenants$/
  );
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
  await expect(page).toHaveURL(/\/dashboard\/activity$/);
  await expect(nav.getByRole("link", { name: /Activiteit/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Activiteit" })).toBeVisible();
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
  await expect(page.locator(".control-brand__logo--inverse")).toBeVisible();

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
  }).toPass({ timeout: 20_000 });
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

test("supports the canonical expanded and compact Publisher sidebar", async ({
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
  await expect(sidebar).toHaveCSS("width", "72px");
  await expect(
    sidebar.getByRole("link", { name: "Overzicht", exact: true })
  ).toBeVisible();
  await expect(sidebar.locator(".control-brand__icon")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("keeps the sidebar logo fixed while navigation and content scroll independently", async ({
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
  const scrollableNavigation = navigation.locator(".control-nav");
  const main = page.getByRole("main");
  const brand = sidebar.locator(".control-brand");
  await expect(brand).toBeVisible();
  await expect.poll(async () => (await brand.boundingBox())?.y).toBe(20);
  const brandBeforeY = (await brand.boundingBox())?.y;

  await expect(sidebar).toHaveCSS("overflow", "hidden");
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
  expect((await brand.boundingBox())?.y).toBe(brandBeforeY);
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
        ".control-mobile-nav"
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
  }).toPass({ timeout: 20_000 });
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

  await expect(topbar).toHaveCSS("min-height", "56px");
  await Promise.all([
    expect(page.getByRole("button", { name: "Navigatie openen" })).toHaveCount(0),
    expect(searchButton).toBeVisible(),
    expect(mobileNavigation).toBeVisible(),
    expect(
      mobileNavigation.getByRole("link", { name: "Schermen" })
    ).toHaveAttribute("aria-current", "page"),
    expect(page.getByRole("button", { name: "Open actiepunten" })).toHaveCount(0),
    expect(page.getByRole("link", { name: "Nieuwe playlist" })).toHaveCount(0)
  ]);

  const [searchBox, topbarBox] = await Promise.all([
    searchButton.boundingBox(),
    topbar.boundingBox()
  ]);

  expect(searchBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(
    topbarBox!.y + topbarBox!.height
  );

  await mobileNavigation.getByRole("button", { name: "Meer" }).click();

  const navigation = page.getByRole("navigation", {
    exact: true,
    name: "Hoofdnavigatie"
  });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Studio/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await follow(
    page,
    () => mobileNavigation.getByRole("link", { name: "Studio" }),
    /\/dashboard\/studio$/
  );
});
