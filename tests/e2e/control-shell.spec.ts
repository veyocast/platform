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
  await expect(nav.getByRole("link", { name: /Overzicht/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Playlists/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Integraties/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Releases/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Schermen/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team/ })).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Werkplek" })).toBeAttached();
  await expect(nav.getByRole("heading", { name: "Beheer" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);

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

  await follow(
    page,
    () => nav.getByRole("link", { name: /Playlists/ }),
    /\/dashboard\/playlists$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nieuwe playlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Playlistoverzicht" })).toBeVisible();

  await follow(
    page,
    () => nav.getByRole("link", { name: /Integraties/ }),
    /\/dashboard\/integrations$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Integraties" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Twelve Producten" })).toBeVisible();
  await follow(
    page,
    () => page.getByRole("link", { name: "Twelve Producten openen" }),
    /\/dashboard\/integrations\/twelve-products$/
  );
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Twelve Producten" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nog geen producten" })).toBeVisible();

  await follow(
    page,
    () => nav.getByRole("link", { name: /Releases/ }),
    /\/dashboard\/releases$/
  );
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Release Center" })).toBeVisible();
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
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schermvloot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toBeVisible();

  await follow(
    page,
    () => page.getByRole("link", { name: "Scherm toevoegen" }),
    /\/dashboard\/screens\/new$/
  );
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Scherm toevoegen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schermdetails en eerste content" })).toBeVisible();

  await expect(async () => {
    if (/\/platform$/.test(page.url())) return;
    await page.locator("summary").filter({ hasText: "Museumkwartier" }).click();
    await page.getByRole("button", { name: /VeyoCast platform/ }).click();
    await expect(page).toHaveURL(/\/platform$/);
  }).toPass({ timeout: 20_000 });
  await expect(nav.getByText("Platformcontext")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Media/ })).toHaveCount(0);
  await follow(
    page,
    () => nav.getByRole("link", { name: /Tenants/ }),
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
  await follow(
    page,
    () => nav.getByRole("link", { name: /Activiteit/ }),
    /\/dashboard\/auditlog$/
  );
  await expect(page.getByRole("heading", { name: "Activiteit" })).toBeVisible();
});

test("persists theme and density preferences without a color flash", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dashboard");

  await expect(async () => {
    if ((await page.locator("html").getAttribute("data-theme")) !== "dark") {
      const switcher = page.locator("details.control-theme-switcher");
      if ((await switcher.getAttribute("open")) === null) {
        await page
          .getByRole("button", {
            name: /Thema en dichtheid: (Systeem|Donker)/
          })
          .click();
      }
      await expect(switcher).toHaveAttribute("open", "");
      await page
        .getByRole("radio", { name: "Donker" })
        .click();
    }
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("veyocast-control-theme")
        )
      )
      .toBe("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }).toPass({ timeout: 45_000 });
  await expect(page.locator(".control-brand__logo--inverse")).toBeVisible();

  await expect(async () => {
    if ((await page.locator("html").getAttribute("data-density")) !== "compact") {
      const switcher = page.locator("details.control-theme-switcher");
      if ((await switcher.getAttribute("open")) === null) {
        await page
          .getByRole("button", { name: "Thema en dichtheid: Donker" })
          .click();
      }
      await expect(switcher).toHaveAttribute("open", "");
      await page
        .getByRole("radio", { name: "Compact" })
        .click();
    }
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("veyocast-control-density")
        )
      )
      .toBe("compact");
    await expect(page.locator("html")).toHaveAttribute(
      "data-density",
      "compact"
    );
  }).toPass({ timeout: 45_000 });

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

test("keeps the Publisher sidebar fixed at the canonical desktop width", async ({
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
  await expect(sidebar).toHaveCSS("width", "224px");
  await expect(
    sidebar.getByRole("link", { name: /Overzicht/ })
  ).toBeVisible();
  await expect(sidebar.locator(".control-brand__logo--inverse")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })
  ).toHaveCount(0);
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
  const main = page.getByRole("main");
  const brand = sidebar.locator(".control-brand");
  await expect(brand).toBeVisible();
  await expect.poll(async () => (await brand.boundingBox())?.y).toBe(16);
  const brandBeforeY = (await brand.boundingBox())?.y;

  await expect(sidebar).toHaveCSS("overflow", "hidden");
  await expect(navigation).toHaveCSS("overflow-y", "auto");
  await expect(main).toHaveCSS("overflow-y", "auto");

  await main.evaluate((element) => element.scrollTo({ top: 900 }));
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await brand.boundingBox())?.y).toBe(brandBeforeY);

  const navCanScroll = await navigation.evaluate(
    (element) => element.scrollHeight > element.clientHeight
  );
  expect(navCanScroll).toBe(true);
  await navigation.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  expect(await navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await brand.boundingBox())?.y).toBe(brandBeforeY);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
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

  await expect(topbar).toHaveCSS("min-height", "64px");
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
  await follow(
    page,
    () => navigation.getByRole("link", { name: /Media/ }),
    /\/dashboard\/media$/
  );
});
