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
      await expect(page.getByRole("dialog", { name: "Nieuw scherm instellen" })).toBeVisible();
      await expect(page.locator("[data-screen-setup-grid]:visible").first()).toBeVisible();
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

test("screen onboarding becomes a sequential mobile flow without horizontal overflow", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/screens/new");

  const dialog = page.getByRole("dialog", { name: "Nieuw scherm instellen" });
  const steps = dialog.getByLabel("Scherminstelstappen");
  await expect(dialog).toBeVisible();
  await expect(steps.locator("li")).toHaveText(["1Scherm", "2Content", "3Controleren"]);
  await expect(steps.locator('[aria-current="step"]')).toContainText("Scherm");
  await expect(dialog.getByLabel("Schermnaam", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Volgende", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("status")).toContainText("Er wordt niets aangemaakt");
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

});

test("playlist authoring and settings remain sequential on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await navigate(page, "/dashboard/playlists");
  await expect(page.locator("#control-content").getByRole("heading", { exact: true, level: 1, name: "Playlists" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Playlistbibliotheek" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Even bijwerken. Klaar." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Zoek een playlist" })).toBeVisible();
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

    await navigate(page, "/dashboard/media");
    const search = page.getByLabel("Zoeken in media");
    await expect(search).toBeVisible();
    expect((await search.boundingBox())?.height).toBe(viewport.width < 768 ? 46 : 21.5);
  }
});
