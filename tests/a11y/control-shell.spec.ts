import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These route-level checks share one lazily compiling Next.js development
// server. Keeping this file serial prevents concurrent first-load compiles
// from replacing one route with another route's loading boundary.
test.describe.configure({ mode: "serial" });

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Goedemorgen,/ })).toBeVisible();
  await expect(page.getByText("Schermen online", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nog niets actief" })).toBeVisible();
});

test("fixed FieldFlow tenant navigation remains keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const sidebar = page.getByLabel("Control navigatie");
  const overview = sidebar.getByRole("link", { name: "Overzicht", exact: true });
  await expect(sidebar).toHaveCSS("width", "248px");
  await expect(sidebar.locator(".control-brand__logo--inverse")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })
  ).toBeVisible();
  await expect
    .poll(async () => {
      await overview.focus();
      return overview.evaluate((element) => element === document.activeElement);
    })
    .toBe(true);
});

test("control shell reflows across canonical viewport widths", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  for (const width of [320, 390, 768, 1024, 1100, 1280, 1920]) {
    await page.setViewportSize({ height: 900, width });

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
        mobileNavigation.getByRole("link", { name: "Overzicht", exact: true })
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
      await page.keyboard.press("Escape");
      await expect(moreButton).toHaveAttribute("aria-expanded", "false");
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
      await expect(navigation.getByRole("link", { name: "Studio", exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Instellingen/ })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
    } else {
      const sidebar = page.getByLabel("Control navigatie");
      await expect(sidebar).toHaveCSS("width", "248px");
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
  await expect(mobileNavigation.getByRole("link", { name: "Planning" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Klanten" })).toHaveCount(0);

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
  await expect(platformNavigation.getByRole("link", { name: /Klanten/ })).toBeVisible();
  await expect(platformNavigation.getByRole("link", { name: /Playlists/ })).toHaveCount(0);
  await platformPage.close();
});

test("all Control overview routes remain inside the viewport", async ({ page }) => {
  test.setTimeout(600_000);

  const routes = [
    "/dashboard",
    "/dashboard/integrations",
    "/dashboard/integrations/twelve-products",
    "/dashboard/media",
    "/dashboard/planning",
    "/dashboard/playlists",
    "/dashboard/releases",
    "/dashboard/screens/groups",
    "/dashboard/screens",
    "/dashboard/sponsors",
    "/dashboard/settings",
    "/dashboard/settings/billing",
    "/dashboard/studio",
    "/dashboard/studio/new",
    "/dashboard/team",
    "/dashboard/templates",
    "/dashboard/auditlog",
    "/platform",
    "/platform/billing",
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

test("dynamic content workspaces remain usable on mobile and desktop", async ({
  page
}) => {
  test.setTimeout(120_000);

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ height: 900, width });
    for (const route of [
      "/dashboard/data-sources",
      "/dashboard/slides",
      "/dashboard/slides/new",
      "/platform/templates",
      "/platform/templates/new"
    ]) {
      await expect(async () => {
        try {
          await page.goto(route, { waitUntil: "domcontentloaded" });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) {
            throw error;
          }
        }
        await expect(page.locator("#control-content")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth
          ),
          `${route} heeft geen horizontale overflow op ${width}px`
        ).toBe(true);
      }).toPass({ timeout: 20_000 });
    }
  }
});

test("Bronnen exposes Twelve Producten as a responsive secondary journey", async ({
  page
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/dashboard/sources");

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: "Databronnen" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Twelve-import" })
    ).toBeVisible();
    await expect(page.getByText("Nog geen databronnen")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true);

    await expect(async () => {
      if (!/\/dashboard\/sources\/twelve\/products$/.test(page.url())) {
        await page.getByRole("link", { name: "Twelve-import" }).click();
      }
      await expect(page).toHaveURL(/\/dashboard\/sources\/twelve\/products$/);
    }).toPass({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", {
        exact: true,
        level: 1,
        name: "Twelve Producten"
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nog geen producten" })
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true);
  }
});

test("screen workspace keeps its primary controls readable on desktop and mobile", async ({ page }) => {
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 844, width: 390 }
  ]) {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width
    });
    await expect(async () => {
      try {
        await page.goto("/dashboard/screens");
      } catch (error) {
        if (!String(error).includes("ERR_ABORTED")) throw error;
      }
      await expect(page.getByLabel("Zoeken in de schermvloot")).toBeVisible();
    }).toPass({ timeout: 20_000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
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
  // Warm the lazily compiled App Router segment before testing client-side
  // keyboard navigation; otherwise Next dev can replace the first transition
  // with a Fast Refresh reload of the current route.
  await expect(async () => {
    try {
      await page.goto("/context");
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page.getByRole("heading", { name: "Kies een vereniging" })).toBeVisible();
  }).toPass({ timeout: 20_000 });
  await expect(async () => {
    try {
      await page.goto("/dashboard");
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page.getByRole("heading", { name: /Goedemorgen,/ })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  const switcher = page.getByRole("button", {
    name: "Actieve context: Museumkwartier"
  });
  await switcher.focus();
  await expect(switcher).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Werkcontext wisselen" })).toBeVisible();
  const contextLink = page.getByRole("link", { name: "Alle contexten beheren" });
  await contextLink.focus();
  await expect(contextLink).toBeFocused();
  await Promise.all([
    page.waitForURL(/\/context$/, { timeout: 10_000 }),
    contextLink.press("Enter")
  ]);
  await expect(page.getByRole("heading", { name: "Kies een vereniging" })).toBeVisible();
  await expect(page.getByText("niet automatisch een willekeurige context gekozen")).toBeVisible();
});

test("media route exposes upload intake labels and status landmarks", async ({
  page
}) => {
  test.slow();
  await page.goto("/dashboard/media");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: "Snel naar een onderdeel" })
  ).toBeEnabled();
  await page.waitForTimeout(250);

  await expect(page.getByRole("heading", { exact: true, name: "Media" })).toBeVisible();
  await expect(page.getByLabel("Samenvatting mediabibliotheek")).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "Media als raster tonen" })).toBeVisible();
  await page.getByText("Upload- en verwerkingsregels", { exact: true }).click();
  await expect(page.getByLabel("Media pipeline stappen")).toContainText(
    "Veilig activeren"
  );
  await expect(page.getByRole("status").filter({
    hasText: "Uploaden is niet beschikbaar in de demomodus"
  })).toBeVisible();

  const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
  await expect(async () => {
    try {
      await page.goto("/dashboard/media?upload=1", { waitUntil: "commit" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(uploadDialog).toBeVisible();
  }).toPass({ timeout: 20_000 });
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

  await page.getByRole("link", { name: "Media als raster tonen" }).click();
  await expect(page).toHaveURL(/view=grid/);
  await expect(page.getByRole("link", { name: "Media als raster tonen" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("region", { name: "Mediabibliotheek" })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  const mobileFilterTrigger = page.getByRole("button", { name: "Filters" });
  await expect(mobileFilterTrigger).toBeVisible();
  await mobileFilterTrigger.click();
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

test("Publicaties keeps immutable history semantics readable on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/releases");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Publicaties" })).toBeVisible();
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

test("settings and theme routes expose real defaults with safe permission state", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.locator(".settings-category-workspace")).toHaveAttribute("data-hydrated", "true");

  await page.goto("/dashboard/themes/fieldflow");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "FieldFlow" })).toBeVisible();
  const themePreview = page.getByLabel(/Live voorbeeld van het .* palet/);
  await expect(themePreview).toBeVisible();
  const previewCanvas = themePreview.locator('[data-theme-tokens~="canvas"]');
  const previewBox = await previewCanvas.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(Math.abs((previewBox!.width / previewBox!.height) - (16 / 9)))
    .toBeLessThan(0.03);
  expect(await themePreview.locator("[data-theme-tokens]").evaluateAll((nodes) => (
    [...new Set(nodes.flatMap((node) => (
      node.getAttribute("data-theme-tokens")?.split(" ") ?? []
    )))]
  ))).toHaveLength(26);
  await expect(page.getByRole("heading", { name: "Slidehuisstijl" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Licht" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Donker" })).toBeVisible();
  await expect(page.getByLabel("Achtergrond clublogo kiezen")).toBeVisible();
  await expect(page.getByLabel("Achtergrond clublogo als kleurwaarde")).toBeVisible();
  await expect(page.getByLabel("Achtergrond thuislogo kiezen")).toBeVisible();
  await expect(page.getByLabel("Achtergrond thuislogo als kleurwaarde")).toBeVisible();
  await expect(page.getByLabel("Slideachtergrond als kleurwaarde")).toBeVisible();
  await expect(page.getByLabel("Slideachtergrond kiezen")).toBeVisible();
  const accentValue = page.getByLabel("Hoofdkleur als kleurwaarde");
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await accentValue.evaluate((input) => input.removeAttribute("disabled"));
  await accentValue.fill("#1");
  await expect(page.getByRole("heading", { name: "Slidehuisstijl" })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await expect(page.locator('input[name^="light-"]')).toHaveCount(26);
  await expect(page.locator("details")).toHaveCount(7);
  await expect(page.locator("[data-disclosure-indicator]")).toHaveCount(7);
  const statusGroup = page.locator("details").filter({ hasText: "Accent en status" });
  await statusGroup.locator("summary").click();
  await expect(statusGroup).toHaveAttribute("open", "");
  await expect(page.getByLabel("Succes als kleurwaarde")).toBeVisible();
  expect((await new AxeBuilder({ page })
    .include(".settings-theme-form")
    .analyze()).violations).toEqual([]);
  await expect(page.getByRole("heading", { name: "Typografie", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  await expect(async () => {
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
  }).toPass();

  await page.goto("/dashboard/settings");
  await expect(async () => {
    if (!(await page.getByLabel("Afbeeldingsduur in seconden").isVisible())) {
      await page.getByRole("button", { name: "Afspelen", exact: true }).click();
    }
    await expect(page.getByLabel("Afbeeldingsduur in seconden")).toBeVisible();
  }).toPass();
  await expect(page.getByLabel("Video standaard zonder geluid")).toBeVisible();
  await expect(async () => {
    if (!(await page.getByLabel("Oriëntatie").isVisible())) {
      await page.getByRole("button", { name: "Schermen", exact: true }).click();
    }
    await expect(page.getByLabel("Oriëntatie")).toBeVisible();
  }).toPass();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Configureer Supabase");
});

test("billing surfaces explain shadow mode and remain usable on mobile", async ({ page }) => {
  for (const route of ["/dashboard/settings/billing", "/platform/billing"]) {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(route);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }

  await page.goto("/dashboard/settings/billing");
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Abonnement & facturatie" })
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Shadowmodus" })).toBeVisible();
  await expect(page.getByText("€ 5,95 incl. btw", { exact: false })).toBeVisible();

  await page.goto("/platform/billing");
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Billing health" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  await expect(page.getByText("Gezondheid van de billingpipeline.")).toBeVisible();
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

  await page.goto("/platform/tenants?fout=onverwacht#nieuwe-tenant");
  await expect(
    page.getByRole("alert").filter({ hasText: "Aanmaken mislukt" })
  ).toBeVisible();
  await expect(page.locator("#nieuwe-tenant")).toContainText(
    "De vereniging kon niet veilig worden aangemaakt"
  );
});

test("screens onboarding exposes labelled lifecycle and safely disabled creation", async ({ page }) => {
  // Warm the lazily compiled onboarding segment so the keyboard/click journey
  // is not replaced by a Next dev Fast Refresh of the screens overview.
  await expect(async () => {
    try {
      await page.goto("/dashboard/screens/new");
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page.getByLabel("Onboardingstappen")).toContainText("Player koppelen");
  }).toPass({ timeout: 20_000 });
  await expect(async () => {
    try {
      await page.goto("/dashboard/screens");
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
    ).toBeVisible();
  }).toPass({ timeout: 20_000 });

  await expect(page.getByRole("status").filter({ hasText: "geen fictieve schermen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toHaveCount(0);
  await page.goto("/dashboard/screens/new");
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
  await expect(
    page.locator("#control-content").getByText("Demomodus", { exact: true })
  ).toBeVisible();
});

test("public auth routes have clear headings and forms", async ({ context, page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij VeyoCast Control" })
  ).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Tenant")).toBeVisible();

  const forgotPasswordPage = await context.newPage();
  await forgotPasswordPage.goto("/forgot-password");
  await expect(
    forgotPasswordPage.getByRole("heading", {
      name: "Nieuw wachtwoord aanvragen"
    })
  ).toBeVisible();
  await expect(forgotPasswordPage.getByLabel("E-mailadres")).toBeVisible();
  await expect(
    forgotPasswordPage.getByRole("button", { name: "Herstelmail aanvragen" })
  ).toBeVisible();
  await forgotPasswordPage.close();

  const invitePage = await context.newPage();
  await invitePage.goto("/accept-invite");
  await expect(invitePage.getByRole("heading", { name: "Uitnodiging afronden" })).toBeVisible();
  await expect(invitePage.getByText("geen geldige uitnodigingssessie")).toBeVisible();
  await expect(invitePage.getByLabel("Nieuw wachtwoord")).toHaveCount(0);
  await invitePage.close();
});
