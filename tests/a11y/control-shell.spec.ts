import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Route checks use the configured single worker for the lazily compiling server.
// Each has a fresh browser context and no dependency on an earlier test, so a
// failed check must not suppress the remaining route/keyboard evidence.
test.describe.configure({ mode: "default" });

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Mooi dat je er bent,/ })).toBeVisible();
  await expect(page.getByText("Schermen bereikbaar", { exact: true })).toBeVisible();
  await expect(page.getByText("Nog geen bevestigde inhoud", { exact: true })).toBeVisible();
});

test("fixed Sync tenant navigation remains keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const sidebar = page.getByLabel("Control navigatie");
  const overview = sidebar.getByRole("link", { name: "Overzicht", exact: true });
  await expect(sidebar).toHaveCSS("width", "228px");
  await expect(sidebar.locator(".vx-brand img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })
  ).toBeHidden();
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
      ).toBeVisible();
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

      const moreButton = page.getByRole("button", { name: "Navigatie openen" });
      await expect(moreButton).toBeEnabled();
      await moreButton.click();
      await expect(moreButton).toHaveAttribute("aria-expanded", "true");
      const navigation = page.getByRole("navigation", {
        name: "Hoofdnavigatie"
      });
      await expect(page.getByLabel("Control navigatie").getByRole("link", { name: /Instellingen/ })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(moreButton).toHaveAttribute("aria-expanded", "false");
    } else {
      const sidebar = page.getByLabel("Control navigatie");
      await expect(sidebar).toHaveCSS("width", width <= 1200 ? "205px" : "228px");
      await expect(page.getByRole("button", { name: "Navigatie openen" })).not.toBeVisible();
      await expect(page.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Snel naar een onderdeel" })).toBeEnabled();
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
  await expect(mobileNavigation.getByRole("link", { name: "Planning" })).toBeVisible();
  await expect(mobileNavigation.locator("a,button")).toHaveText(["Overzicht", "Content", "Playlists", "Planning", "Schermen"]);
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

for (const width of [320, 390, 768, 1024, 1100, 1280]) {
 test(`all Control overview routes remain inside the viewport at ${width}px`, async ({ page }) => {
  test.setTimeout(300_000);

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

  await page.setViewportSize({ height: 900, width });

    for (const route of routes) {
      const destination = ({
        "/dashboard/integrations": "/dashboard/sources",
        "/dashboard/integrations/twelve-products": "/dashboard/sources/twelve/products",
        "/dashboard/releases": "/dashboard/publications",
        "/dashboard/studio": "/dashboard/content",
        "/dashboard/templates": "/dashboard/playlist-templates",
        "/dashboard/auditlog": "/dashboard/activity"
      } as Record<string, string>)[route] ?? route;
      await expect(async () => {
        try {
          await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15_000 });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
        }
        // App Router can render the shell before a server redirect finishes.
        // Measure the settled destination, including Studio's Content redirect.
        await page.waitForURL(url => url.pathname === destination, {
          waitUntil: "domcontentloaded", timeout: 15_000
        });
        await expect(page.locator("#control-content"), `${route} laadt na ontwikkelserverherstart op ${width}px`).toBeVisible();
      }, `${route} heeft maximaal 90 seconden om na een ontwikkelserverherstart te laden op ${width}px`).toPass({ timeout: 90_000 });
      expect.soft(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        ),
        `${route} blijft binnen ${width}px`
      ).toBe(true);
    }
 });
}

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
          await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15_000 });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) {
            throw error;
          }
        }
        if (route === "/dashboard/slides/new") {
          // The legacy alias redirects asynchronously after its initial SSR.
          // Wait for the destination before asserting its modal or retrying.
          await page.waitForURL(/\/dashboard\/studio\/new(?:\?|$)/, {
            waitUntil: "domcontentloaded", timeout: 15_000
          });
        }
        await expect(page.locator("#control-content"), `${route} laadt op ${width}px`).toBeVisible();
        if (route === "/dashboard/slides/new") {
          const chooser=page.getByRole("dialog", {name:"Wat wil je maken?"});
          await expect(chooser).toBeVisible();
          await expect(chooser.getByRole("heading", {name:"Wat wil je maken?"})).toBeVisible();
          await page.keyboard.press("Tab");
          expect(await chooser.evaluate(element=>element.contains(document.activeElement))).toBe(true);
          await page.keyboard.press("Escape");
          await expect(chooser).toBeHidden();
        }
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth
          ),
          `${route} heeft geen horizontale overflow op ${width}px`
        ).toBe(true);
      }, `${route} herstelt van een ontwikkelserverherstart op ${width}px`).toPass({ timeout: 20_000 });
    }
  }
});

test("Sync Bronnen and Producten distinguish an empty library from a connected provider", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/dashboard/sources");
    await expect(page.getByRole("heading", { exact: true, level: 1, name: "Alles begint bij goede gegevens." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nog geen bronnen verbonden", exact: true })).toBeVisible();
    await expect(page.locator(".ad-source")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bron toevoegen", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Bron toevoegen", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { exact: true, level: 1, name: "Een frisse kaart voor je club." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Geen producten gevonden", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Product toevoegen", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Producten zoeken")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
      await expect(page.getByLabel("Zoek scherm")).toBeVisible();
    }).toPass({ timeout: 20_000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }
});

test("Source resource filters remain keyboard reachable through compact desktop", async ({ page }) => {
  for (const width of [1100, 1440]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/dashboard/playlists");
    const library = page.getByRole("region", { name: "Playlistbibliotheek" });
    const trigger = library.getByRole("button", { exact: true, name: "Filters" });
    await expect(library.getByLabel("Playlists zoeken")).toBeVisible();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(library.getByRole("combobox", { exact: true, name: "Status" })).not.toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(library.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
    await expect(library.getByRole("combobox", { exact: true, name: "Sorteren" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
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
    await expect(page.getByRole("heading", { name: /Mooi dat je er bent,/ })).toBeVisible();
  }).toPass({ timeout: 20_000 });

  const switcher = page.getByRole("button", {
    name: "Actieve context: Museumkwartier"
  });
  await expect(switcher).toBeEnabled();
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
  const advancedFilters = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Aanvullende filters en opgeslagen weergaven" }) });
  const advancedSummary = advancedFilters.locator("summary");
  await advancedSummary.focus();
  await page.keyboard.press("Enter");
  await expect(advancedFilters).toHaveAttribute("open", "");
  const mediaFilterTrigger = advancedFilters.getByRole("button", {
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
  await expect(page.getByRole("link", { name: "Media als raster tonen" }).first()).toBeVisible();
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

  await page.getByRole("link", { name: "Media als raster tonen" }).first().click();
  await expect(page).toHaveURL(/view=grid/);
  await expect(page.getByRole("link", { name: "Media als raster tonen" }).first()).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("region", { name: "Mediabibliotheek" })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  if ((await advancedFilters.getAttribute("open")) === null) {
    await advancedSummary.focus();
    await page.keyboard.press("Enter");
  }
  await expect(advancedFilters).toHaveAttribute("open", "");
  const mobileFilterTrigger = advancedFilters.getByRole("button", { name: "Filters", exact: true });
  await expect(mobileFilterTrigger).toBeVisible();
  if ((await mobileFilterTrigger.getAttribute("data-state")) !== "open") await mobileFilterTrigger.click();
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
    page.getByRole("main").getByRole("heading", { exact: true, level: 1, name: "Je playlists" })
  ).toBeVisible();
  const library = page.getByRole("region", { name: "Playlistbibliotheek" });
  const trigger = library.getByRole("button", { exact: true, name: "Filters" });
  await expect(library.getByLabel("Playlists zoeken")).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(library.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
  await expect(library.getByRole("combobox", { exact: true, name: "Sorteren" })).toBeVisible();
  await expect(library.getByRole("heading", { name: "Een nieuw verhaal", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Configureer Supabase" })).toBeVisible();
  await expect(library.getByRole("button", { name: "Nieuwe playlist" })).toBeDisabled();
  await expect(library.getByRole("button", { name: /Een nieuw verhaal/ })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Uitgebreid overzicht met kolommen, schermfilters en verwijderen" })).toHaveCount(0);
  // Historical links must retain search and resolve to the same library.
  await page.goto("/dashboard/playlists?advanced=1&q=clubverhaal");
  await expect(page).toHaveURL(/\/dashboard\/playlists\?q=clubverhaal$/);
  await expect(library).toBeVisible();
  await expect(library.getByLabel("Playlists zoeken")).toHaveValue("clubverhaal");
  await expect(library.getByRole("button", { name: "Nieuwe playlist", exact: true })).toHaveCount(1);
  await expect(library.getByRole("button", { name: "Nieuwe playlist", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Playlistoverzicht" })).toHaveCount(0);
});

test("Publicaties explains current publication and live data on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/releases");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Publicaties" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Gepubliceerd" })).toBeVisible();
  await expect(page.getByText(/live gegevens verversen zelfstandig/i)).toBeVisible();
  await expect(page.getByText(/Schermstatus bevestigt afzonderlijk wat werkelijk wordt getoond/i)).toBeVisible();
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
  await expect(page.locator('[data-settings-workspace="true"]')).toHaveAttribute("data-hydrated", "true");

  await page.goto("/dashboard/themes/fieldflow");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Huisstijl" })).toBeVisible();
  const themePreview = page.getByLabel("Live voorbeeld van het lichte palet", { exact: true });
  await expect(page.getByLabel("Navy Glass live kleurvoorbeeld (donker palet)", { exact: true })).toBeVisible();
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
    page.getByRole("heading", { exact: true, level: 1, name: "Alles helder geregeld." })
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nog niet geactiveerd" })).toBeVisible();
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

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Samen aan het stuur." })).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Uitnodiging versturen" })).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Configureer Supabase" })
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Toegang binnen de actieve vereniging." })).toBeVisible();
  await expect(page.getByRole("table", { name: "Toegang binnen de actieve vereniging." }).locator("tbody tr")).toHaveCount(0);
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
    await expect(page.getByRole("dialog", { name: "Een scherm toevoegen" })).toBeVisible();
  }).toPass({ timeout: 20_000 });
  await expect(async () => {
    try {
      await page.goto("/dashboard/screens");
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(
      page.getByRole("main").getByRole("heading", { exact: true, level: 1, name: "Jouw club. Overal in beeld." })
    ).toBeVisible();
  }).toPass({ timeout: 20_000 });

  await expect(page.getByRole("button", { name: "Scherm koppelen", exact: true })).toBeDisabled();
  await expect(page.locator(".px-screen-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toHaveCount(0);
  await page.goto("/dashboard/screens/new");
  const setup = page.getByRole("dialog", { name: "Een scherm toevoegen" });
  await expect(setup).toBeVisible();
  await expect(setup.getByRole("heading", { name: "Open VeyoCast op je scherm", exact: true })).toBeVisible();
  const platforms = setup.getByRole("group", { name: "Installatie-instructie voor je Player" });
  await expect(platforms.getByRole("button")).toHaveText(["Android", "LG webOS", "Web"]);
  for (const button of await platforms.getByRole("button").all()) {
    await expect(button).toBeEnabled();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await expect(setup.getByLabel("Schermnaam")).toHaveCount(0);
  await expect(setup.getByLabel("Schermgroep", { exact: true })).toHaveCount(0);
  await expect(setup.locator("form")).toHaveCount(0);
  await expect(setup.getByRole("button", { name: "Ik heb een koppelcode", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Er wordt niets aangemaakt" })).toBeVisible();
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
  test.slow();
  // Warm the real route before the browser's bounded PWA navigation deadline.
  // Cold Next development compilation can legitimately take longer than the
  // network deadline and return the privacy-preserving offline document.
  for (const path of ["/login", "/forgot-password", "/accept-invite"]) {
    expect((await page.request.get(path)).status(), path).toBe(200);
  }
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
