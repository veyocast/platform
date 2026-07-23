import { expect, test } from "@playwright/test";

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welkom, Daan Operator" })).toBeVisible();
  await expect(page.getByText("Veilige lege staat")).toBeVisible();
  await expect(page.getByText("Deze route simuleert daarom geen klant")).toBeVisible();
});

test("fixed Publisher navigation remains keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const sidebar = page.getByLabel("Control navigatie");
  const overview = sidebar.getByRole("link", { name: /Overzicht/ });
  await expect(sidebar).toHaveCSS("width", "224px");
  await expect(sidebar.locator(".control-brand__logo--inverse")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })
  ).toHaveCount(0);
  await overview.focus();
  await expect(overview).toBeFocused();
});

test("control shell reflows across canonical viewport widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1100, 1280, 1920]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);

    if (width < 768) {
      await expect(
        page.getByRole("button", { name: "Navigatie openen" })
      ).toHaveCount(0);
      const mobileNavigation = page.getByRole("navigation", {
        name: "Mobiele hoofdnavigatie"
      });
      await expect(mobileNavigation).toBeVisible();
      await expect(
        mobileNavigation.getByRole("link", { name: "Home" })
      ).toHaveAttribute("aria-current", "page");

      for (const control of await mobileNavigation
        .locator("a, button")
        .all()) {
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }

      const moreButton = mobileNavigation.getByRole("button", { name: "Meer" });
      await expect(moreButton).toBeEnabled();
      await moreButton.click();
      await expect(moreButton).toHaveAttribute("aria-expanded", "true");
      const navigation = page.getByRole("navigation", {
        name: "Hoofdnavigatie"
      });
      await expect(navigation.getByRole("link", { name: /Instellingen/ })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
    } else if (width < 1024) {
      const menuButton = page.getByRole("button", { name: "Navigatie openen" });
      const quickNavigation = page.getByRole("button", {
        name: "Snel naar een onderdeel"
      });

      for (const control of [menuButton, quickNavigation]) {
        await expect(control).toBeEnabled();
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }

      await menuButton.click();
      const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
      await expect(navigation.getByRole("heading", { name: "Publisher" })).toBeAttached();
      await expect(navigation.getByRole("link", { name: /Instellingen/ })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
    } else {
      const sidebar = page.getByLabel("Control navigatie");
      await expect(sidebar).toHaveCSS("width", "224px");
      await expect(
        page.getByRole("navigation", { name: "Hoofdnavigatie" })
      ).toBeVisible();
    }
  }
});

test("mobile navigation never mixes tenant and platform destinations", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobiele hoofdnavigatie"
  });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Playlists" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Tenants" })).toHaveCount(0);

  const platformPage = await page.context().newPage();
  await platformPage.setViewportSize({ height: 844, width: 390 });
  await platformPage.goto("/platform");
  await platformPage.waitForLoadState("networkidle");
  await expect(
    platformPage.getByRole("navigation", { name: "Mobiele hoofdnavigatie" })
  ).toHaveCount(0);
  await expect(
    platformPage.getByRole("button", { name: "Navigatie openen" })
  ).toBeVisible();
  await platformPage.getByRole("button", { name: "Navigatie openen" }).click();
  const platformNavigation = platformPage.getByRole("navigation", {
    name: "Hoofdnavigatie"
  });
  await expect(platformNavigation.getByRole("link", { name: /Tenants/ })).toBeVisible();
  await expect(platformNavigation.getByRole("link", { name: /Playlists/ })).toHaveCount(0);
  await platformPage.close();
});

test("all Control overview routes remain inside the viewport", async ({ page }) => {
  test.setTimeout(120_000);

  const routes = [
    "/dashboard",
    "/dashboard/media",
    "/dashboard/planning",
    "/dashboard/playlists",
    "/dashboard/releases",
    "/dashboard/screen-groups",
    "/dashboard/screens",
    "/dashboard/settings",
    "/dashboard/team",
    "/dashboard/templates",
    "/dashboard/auditlog",
    "/platform",
    "/platform/tenants",
    "/platform/system"
  ];

  for (const width of [320, 390, 768, 1024, 1100, 1280]) {
    await page.setViewportSize({ height: 900, width });

    for (const route of routes) {
      await page.goto("about:blank");
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#control-content")).toBeVisible();
      expect.soft(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        ),
        `${route} blijft binnen ${width}px`
      ).toBe(true);
    }
  }
});

test("resource filters stay bundled through compact desktop", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1100 });
  await page.goto("/dashboard/playlists");

  const trigger = page.getByRole("button", { exact: true, name: "Filters" });
  await expect(trigger).toBeVisible();
  await expect(page.getByLabel("Zoeken in playlists")).toBeVisible();
  await expect(page.getByRole("combobox", { exact: true, name: "Status" })).not.toBeVisible();
  await expect(async () => {
    if ((await trigger.getAttribute("data-state")) !== "open") {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute("data-state", "open");
  }).toPass();
  await expect(page.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
  await expect(page.getByLabel("Compact playlistoverzicht")).toBeVisible();

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.reload();
  await expect(trigger).not.toBeVisible();
  await expect(page.getByLabel("Zoeken in playlists")).toBeVisible();
  await expect(page.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
});

test("activity workspace remains readable without fictional mobile rows", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await page.goto("/dashboard/auditlog");

  await expect(page.getByRole("heading", { name: "Recente gebeurtenissen" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nog geen auditgebeurtenissen" })).toBeVisible();
  await expect(async () => {
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true);
  }).toPass({ timeout: 15_000 });
});

test("tenant context selection is explicit and keyboard reachable", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(async () => {
    if (/\/context$/.test(page.url())) return;
    const switcher = page.locator("summary").filter({ hasText: "Museumkwartier" });
    await switcher.focus();
    await expect(switcher).toBeFocused();
    if (!(await switcher.evaluate((element) => (element.parentElement as HTMLDetailsElement | null)?.open ?? false))) {
      await page.keyboard.press("Enter");
    }
    await expect(page.getByRole("group", { name: "Werkcontext wisselen" })).toBeVisible();
    const contextLink = page.getByRole("link", { name: "Alle contexten beheren" });
    await contextLink.focus();
    await expect(contextLink).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/context$/, { timeout: 4_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Kies een vereniging" })).toBeVisible();
  await expect(page.getByText("niet automatisch een willekeurige context gekozen")).toBeVisible();
});

test("media route exposes upload intake labels and status landmarks", async ({
  page
}) => {
  await page.goto("/dashboard/media");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: "Snel naar een onderdeel" })
  ).toBeEnabled();
  await page.waitForTimeout(250);

  await expect(page.getByRole("heading", { exact: true, name: "Media" })).toBeVisible();
  await expect(page.getByLabel("Samenvatting mediabibliotheek")).toContainText(
    "Actie nodig"
  );
  const mediaFilterTrigger = page.getByRole("button", {
    exact: true,
    name: "Filters"
  });
  await expect(async () => {
    if ((await mediaFilterTrigger.getAttribute("data-state")) !== "open") {
      await mediaFilterTrigger.click();
    }
    await expect(mediaFilterTrigger).toHaveAttribute("data-state", "open");
  }).toPass();
  await expect(page.getByLabel("Filter media op gebruik")).toBeVisible();
  await expect(page.getByRole("link", { name: "Raster" })).toBeVisible();
  await page.getByText("Upload- en verwerkingsregels", { exact: true }).click();
  await expect(page.getByLabel("Media pipeline stappen")).toContainText(
    "Veilig activeren"
  );
  await expect(page.getByRole("status").filter({
    hasText: "Uploaden is niet beschikbaar in de demomodus"
  })).toBeVisible();

  await page.goto("/dashboard/media?upload=1", { waitUntil: "commit" });
  const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
  await expect(uploadDialog).toBeVisible();
  const imageFiles = uploadDialog.getByLabel("Afbeeldingen", { exact: true });
  await expect(imageFiles).toBeVisible();
  await expect(imageFiles).toHaveAttribute("multiple", "");
  await expect(
    uploadDialog.getByLabel("Titel voor één afbeelding", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Uploaden en verifiëren" })).toBeDisabled();
  await uploadDialog.getByRole("tab", { name: "Video" }).click();
  await expect(uploadDialog.getByLabel("Videobestand", { exact: true })).toBeVisible();
  await expect(uploadDialog.getByLabel("Videotitel", { exact: true })).toBeVisible();
  await expect(uploadDialog.getByRole("button", { name: "Video uploaden" })).toBeDisabled();
  await uploadDialog.getByRole("button", { name: "Uploadvenster sluiten" }).click();

  await page.getByRole("link", { name: "Raster" }).click();
  await expect(page).toHaveURL(/view=grid/);
  await expect(page.getByRole("link", { name: "Raster" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("region", { name: "Mediabibliotheek" })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload();
  await page.getByRole("button", { name: "Filters" }).click();
  const fromDate = page.getByLabel("Vanaf");
  await expect(async () => {
    const fromDateBox = await fromDate.boundingBox();
    expect(fromDateBox?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  }).toPass({ timeout: 15_000 });
});

test("playlists route exposes searchable resource filters and safe creation", async ({
  page
}) => {
  await page.goto("/dashboard/playlists");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(async () => {
    const trigger = page.getByRole("button", { exact: true, name: "Filters" });
    if ((await trigger.getAttribute("data-state")) !== "open") await trigger.click();
    await expect(page.getByLabel("Zoeken in playlists")).toBeVisible();
    await expect(page.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
  }).toPass();
  await expect(page.getByRole("combobox", { exact: true, name: "Schermgebruik" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlistoverzicht" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Configureer Supabase" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nieuwe playlist" })).toHaveCount(0);
});

test("Release Center keeps immutable history semantics readable on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/releases");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Release Center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Immutable historie" })).toBeVisible();
  await expect(page.getByText(/rollback is altijd een nieuwe toewijzing/i)).toBeVisible();
  await expect(async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  }).toPass({ timeout: 15_000 });
});

test("settings route exposes real defaults with safe permission state", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Afbeeldingsduur in seconden")).toBeVisible();
  await expect(page.getByLabel("Video standaard zonder geluid")).toBeVisible();
  await expect(page.getByLabel("Oriëntatie")).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Configureer Supabase");
});

test("team route exposes roles and a safely disabled invitation flow", async ({ page }) => {
  await page.goto("/dashboard/team");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Team" })).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Uitnodiging versturen" })).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Configureer Supabase" })
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nog geen teamleden" })).toBeVisible();
});

test("tenant management exposes a labelled and safely disabled creation flow", async ({
  page
}) => {
  await page.goto("/platform/tenants");

  await expect(
    page.getByRole("heading", { exact: true, name: "Tenantbeheer" })
  ).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Technische slug")).toBeVisible();
  await expect(page.getByLabel("E-mailadres eerste eigenaar")).toBeVisible();
  await expect(page.getByLabel("Schermlimiet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vereniging aanmaken" })
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Aanmaken is hier uitgeschakeld"
  );
});

test("screens onboarding exposes labelled lifecycle and safely disabled creation", async ({ page }) => {
  await page.goto("/dashboard/screens");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "geen fictieve schermen" })).toBeVisible();
  await page.getByRole("link", { name: "Scherm toevoegen" }).click();
  await expect(page.getByLabel("Onboardingstappen")).toContainText("Player koppelen");
  await expect(page.getByLabel("Schermnaam")).toBeVisible();
  await expect(page.getByLabel("Eerste content (optioneel)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Scherm maken en doorgaan" })).toBeDisabled();
});

test("pilot route exposes a sequential and fully labelled flow", async ({ page }) => {
  await page.goto("/dashboard/pilot");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Pilotflow" })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Pilotstappen" })).toBeVisible();
  await expect(page.getByLabel("Afbeelding")).toBeVisible();
  await expect(page.getByLabel("Gereedstaande media")).toBeVisible();
  await expect(page.getByLabel("Conceptplaylist")).toBeVisible();
  await expect(page.getByLabel("Koppelcode")).toBeVisible();
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
});

test("public auth routes have clear headings and forms", async ({ context, page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij VeyoCast Control" })
  ).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Tenant")).toBeVisible();

  const invitePage = await context.newPage();
  await invitePage.goto("/accept-invite");
  await expect(invitePage.getByRole("heading", { name: "Uitnodiging afronden" })).toBeVisible();
  await expect(invitePage.getByText("geen geldige uitnodigingssessie")).toBeVisible();
  await expect(invitePage.getByLabel("Nieuw wachtwoord")).toHaveCount(0);
  await invitePage.close();
});
