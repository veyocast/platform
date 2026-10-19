import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, pathname: string) {
  await expect(async () => {
    try {
      await page.goto(pathname, { timeout: 15_000, waitUntil: "commit" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page).toHaveURL(new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    if (pathname === "/dashboard/screens/new") {
      // The portal is mounted by the real hydrated client. A dev-server
      // restart can leave an already rendered server page with stale chunks;
      // retry the finite navigation until this actual wizard is available.
      await expect(page.getByRole("dialog", { name: "Een scherm toevoegen" })).toBeVisible();
      await expect(page.getByRole("group", { name: "Installatie-instructie voor je Player" })).toBeVisible();
    }
  }).toPass({ timeout: 90_000 });
}

async function readDashboardGeometry(page: Page) {
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    };
    const grids = Array.from(document.querySelectorAll<HTMLElement>(".form-grid, [data-settings-field-grid], [data-screen-setup-grid]"))
      .filter(visible)
      .map((grid) => {
        const fields = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .field"))
          .filter(visible)
          .map((field) => {
            const label = field.querySelector<HTMLElement>(":scope > label, :scope > span");
            const control = field.querySelector<HTMLElement>(
              ":scope > input:not([type='hidden']):not([type='checkbox']):not([type='radio']), :scope > select, :scope > textarea"
            );
            const fieldRect = field.getBoundingClientRect();
            const labelRect = label?.getBoundingClientRect();
            const controlRect = control?.getBoundingClientRect();
            return {
              controlHeight: controlRect?.height ?? 0,
              controlTop: controlRect?.top ?? 0,
              controlWidth: controlRect?.width ?? 0,
              fieldTop: fieldRect.top,
              fieldWidth: fieldRect.width,
              labelTop: labelRect?.top ?? 0
            };
          });
        return fields;
      });
    const surfacePadding = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".workspace-section, .data-surface, [data-settings-surface], .vc-dialog__content:has([data-screen-setup-surface])"
      )
    )
      .filter(visible)
      .map((surface) => Number.parseFloat(window.getComputedStyle(surface).paddingLeft));

    return { grids, surfacePadding };
  });
}

function expectCanonicalGeometry(
  geometry: Awaited<ReturnType<typeof readDashboardGeometry>>,
  expectedSurfacePadding: number,
  expectedControlHeight = 44
) {
  expect(geometry.grids.length).toBeGreaterThan(0);
  for (const fields of geometry.grids) {
    for (const field of fields) {
      expect(Math.abs(field.controlWidth - field.fieldWidth)).toBeLessThanOrEqual(1);
      expect(field.controlHeight).toBe(expectedControlHeight);
    }

    const rows = new Map<number, typeof fields>();
    for (const field of fields) {
      const rowTop = Math.round(field.fieldTop);
      rows.set(rowTop, [...(rows.get(rowTop) ?? []), field]);
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      expect(
        Math.max(...row.map(({ labelTop }) => labelTop)) -
          Math.min(...row.map(({ labelTop }) => labelTop))
      ).toBeLessThanOrEqual(1);
      expect(
        Math.max(...row.map(({ controlTop }) => controlTop)) -
          Math.min(...row.map(({ controlTop }) => controlTop))
      ).toBeLessThanOrEqual(1);
    }
  }
  expect(geometry.surfacePadding.length).toBeGreaterThan(0);
  for (const padding of geometry.surfacePadding) {
    expect(padding).toBe(expectedSurfacePadding);
  }
}

async function expectScreenIntro(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Een scherm toevoegen" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Open VeyoCast op je scherm", exact: true })).toBeVisible();
  const platforms = dialog.getByRole("group", { name: "Installatie-instructie voor je Player" });
  await expect(platforms.getByRole("button")).toHaveText(["Android", "LG webOS", "Web"]);
  for (const button of await platforms.getByRole("button").all()) {
    await expect(button).toBeEnabled();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await expect(dialog.getByRole("button", { name: "Ik heb een koppelcode", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Schermnaam", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Schermgroep", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("form, [data-screen-setup-grid]")).toHaveCount(0);
  await expect(dialog.getByRole("status").filter({ hasText: "Er wordt niets aangemaakt" })).toBeVisible();
  return dialog;
}

test("screen onboarding becomes a sequential mobile flow without horizontal overflow", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/screens/new");

  const dialog = await expectScreenIntro(page);
  await expect(dialog.getByRole("button", { name: "Android", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "LG webOS", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "LG webOS", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("status").filter({ hasText: "LG-scherm" })).toBeVisible();
  await dialog.getByRole("button", { name: "Web", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Web", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("status").filter({ hasText: "in de browser" })).toBeVisible();
  await expect(dialog.getByRole("status").filter({ hasText: "Er wordt niets aangemaakt" })).toContainText("Er wordt niets aangemaakt");
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

});

test("playlist authoring and settings remain sequential on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await navigate(page, "/dashboard/playlists");
  await expect(page.locator("#control-content").getByRole("heading", { exact: true, level: 1, name: "Je playlists" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Playlistbibliotheek" })).toBeVisible();
  await expect(page.getByText("Combineer je verhaal. Kies je schermen. Zet het live.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Playlists zoeken" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nieuwe playlist", exact: true })).toBeVisible();
  await expect(async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }).toPass();

  await navigate(page, "/dashboard/settings");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.locator("[data-settings-workspace]")).toHaveAttribute("data-hydrated", "true");

  await navigate(page, "/dashboard/themes/fieldflow");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Huisstijl" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slidehuisstijl" })).toBeVisible();
  const themePreview = page.getByLabel(/Live voorbeeld van het .* palet/);
  await expect(themePreview).toBeVisible();
  const previewBox = await themePreview
    .locator('[data-theme-tokens~="canvas"]')
    .boundingBox();
  expect(previewBox).not.toBeNull();
  expect(Math.abs((previewBox!.width / previewBox!.height) - (16 / 9)))
    .toBeLessThan(0.03);
  await expect(page.getByLabel("Slideachtergrond als kleurwaarde")).toBeVisible();
  await page.locator("details").evaluateAll((details) => {
    for (const detail of details) detail.setAttribute("open", "");
  });
  await expect(page.getByLabel("Lichte fototekst en QR-achtergrond als kleurwaarde"))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "Typografie", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  await expect(async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }).toPass();
});

test("dashboard forms and surfaces share canonical alignment", async ({ page }) => {
  test.setTimeout(180_000);

  for (const viewport of [
    { height: 900, padding: 20, width: 1280 },
    { height: 844, padding: 16, width: 390 }
  ]) {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    for (const route of ["/dashboard/settings", "/dashboard/screens/new"]) {
      await navigate(page, route);
      await expect(page.locator("#control-content")).toBeVisible();
      if (route === "/dashboard/screens/new") {
        const dialog = await expectScreenIntro(page);
        // Demo cannot enter authoring. Its actual platform intro replaces the
        // old three-step form here; field/validation/alignment evidence remains
        // in sync-screen-source and WIZARD47–52 component cases.
        await expect(async () => {
          const geometry = await dialog.evaluate(element => {
            const surface = element.querySelector<HTMLElement>("[data-screen-setup-surface]")!;
            const buttons = Array.from(element.querySelectorAll<HTMLElement>('.px-platform-picks > button'));
            return { padding: Number.parseFloat(getComputedStyle(surface).paddingLeft), tops: buttons.map(button => button.getBoundingClientRect().top) };
          });
          expect(geometry.padding).toBe(viewport.width < 768 ? 18 : 26);
          expect(geometry.tops).toHaveLength(3);
          expect(Math.max(...geometry.tops) - Math.min(...geometry.tops)).toBeLessThanOrEqual(1);
        }).toPass({ timeout: 10_000 });
        continue;
      }
      await expect(page.locator(".form-grid:visible, [data-settings-field-grid]:visible, [data-screen-setup-grid]:visible").first()).toBeVisible();
      await expect(
        page
          .locator(".workspace-section:visible, .data-surface:visible, .vc-dialog__content:has([data-screen-setup-surface]):visible, [data-settings-surface]:visible")
          .first()
      ).toBeVisible();
      // Exact scoped Source metrics: settings Surface 25/20, hardware
      // onboarding modal Surface 24/20; fields exactly44. Settings fields are45/48. These are
      // explicit CSS heights, not a relaxed tolerance around the old 44px UI.
      const touch = viewport.width < 768;
      const sourceSurfacePadding = route === "/dashboard/settings" ? touch ? 20 : 25 : touch ? 20 : 24;
      await expect(async () => { expectCanonicalGeometry(await readDashboardGeometry(page), sourceSurfacePadding, route === "/dashboard/settings" ? touch ? 48 : 45 : 44); }).toPass({ timeout: 10_000 });
      if (route === "/dashboard/settings") {
        const navigationLocator = page.getByRole("navigation", {
          name: "Instellingencategorieën"
        });
        const firstSectionLocator = page.locator("[data-settings-surface]:visible").first();
        await expect(firstSectionLocator).toBeVisible();
        await expect(navigationLocator).toBeVisible();
        await expect(navigationLocator.getByRole("button")).toHaveCount(7);
        await expect(navigationLocator.getByRole("button", { name: "Profiel", exact: true })).toHaveAttribute("aria-current", "page");
      }
    }

    await navigate(page, "/dashboard/content");
    const search = page.getByRole("textbox", { name: "Zoek content", exact: true });
    await expect(search).toBeVisible();
    const searchBox = await search.boundingBox();
    expect(searchBox?.width).toBeGreaterThan(44);
    expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(viewport.width);
    await search.fill("club");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=club/);
    await expect(page.getByRole("textbox", { name: "Zoek content", exact: true })).toHaveValue("club");
  }
});
