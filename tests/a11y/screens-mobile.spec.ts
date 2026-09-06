import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, pathname: string) {
  await expect(async () => {
    try {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page).toHaveURL(new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  }).toPass({ timeout: 20_000 });
}

async function readDashboardGeometry(page: Page) {
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    };
    const grids = Array.from(document.querySelectorAll<HTMLElement>(".form-grid"))
      .filter(visible)
      .map((grid) => {
        const fields = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .field"))
          .filter(visible)
          .map((field) => {
            const label = field.querySelector<HTMLElement>(":scope > label");
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
        ".workspace-section, .data-surface, .onboarding-workspace"
      )
    )
      .filter(visible)
      .map((surface) => Number.parseFloat(window.getComputedStyle(surface).paddingLeft));

    return { grids, surfacePadding };
  });
}

function expectCanonicalGeometry(
  geometry: Awaited<ReturnType<typeof readDashboardGeometry>>,
  expectedSurfacePadding: number
) {
  expect(geometry.grids.length).toBeGreaterThan(0);
  for (const fields of geometry.grids) {
    for (const field of fields) {
      expect(Math.abs(field.controlWidth - field.fieldWidth)).toBeLessThanOrEqual(1);
      expect(field.controlHeight).toBe(44);
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

  const onboarding = page.getByRole("heading", { name: "Schermdetails en eerste content" });
  const steps = page.getByLabel("Onboardingstappen");
  await expect(onboarding).toBeVisible();
  await expect(steps).toContainText("Player koppelen");

  await expect(async () => {
    const [onboardingBox, stepsBox, hasHorizontalOverflow] = await Promise.all([
      onboarding.boundingBox(),
      steps.boundingBox(),
      page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      )
    ]);

    expect(onboardingBox).not.toBeNull();
    expect(stepsBox).not.toBeNull();
    expect(onboardingBox?.y).toBeGreaterThan(
      (stepsBox?.y ?? 0) + (stepsBox?.height ?? 0)
    );
    expect(hasHorizontalOverflow).toBe(false);
  }).toPass({ timeout: 15_000 });
});

test("playlist authoring and settings remain sequential on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await navigate(page, "/dashboard/playlists");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })).toBeVisible();
  await expect(page.getByLabel("Compact playlistoverzicht")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlistoverzicht" })).toBeVisible();
  await expect(async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }).toPass();

  await navigate(page, "/dashboard/settings");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.locator(".settings-category-workspace")).toHaveAttribute("data-hydrated", "true");
  const settingsCategory = page.getByRole("combobox", { name: "Categorie" });
  await expect(settingsCategory).toBeVisible();
  await settingsCategory.selectOption("huisstijl");
  await expect(page.getByRole("heading", { name: "Slidehuisstijl" })).toBeVisible();
  await expect(page.getByLabel(/Live voorbeeld van het .* palet/)).toBeVisible();
  await page.getByText("Compatibiliteit met oudere slides", { exact: true }).click();
  await expect(page.getByLabel("Primaire kleur", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  await expect(async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }).toPass();
});

test("dashboard forms and surfaces share canonical alignment", async ({ page }) => {
  test.setTimeout(90_000);

  for (const viewport of [
    { height: 900, padding: 20, width: 1280 },
    { height: 844, padding: 16, width: 390 }
  ]) {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    for (const route of ["/dashboard/settings", "/dashboard/screens/new"]) {
      await navigate(page, route);
      await expect(page.locator("#control-content")).toBeVisible();
      await expect(page.locator(".form-grid:visible").first()).toBeVisible();
      await expect(
        page
          .locator(".workspace-section:visible, .data-surface:visible, .onboarding-workspace:visible")
          .first()
      ).toBeVisible();
      expectCanonicalGeometry(await readDashboardGeometry(page), viewport.padding);
      if (route === "/dashboard/settings") {
        const navigationLocator = page.getByRole("navigation", {
          name: "Instellingencategorieën"
        });
        const selectLocator = page.getByRole("combobox", { name: "Categorie" });
        const firstSectionLocator = page.locator(".settings-category-panels > .data-surface:visible").first();
        await expect(firstSectionLocator).toBeVisible();
        if (viewport.width < 768) {
          await expect(navigationLocator).not.toBeVisible();
          await expect(selectLocator).toBeVisible();
        } else {
          await expect(navigationLocator).toBeVisible();
          await expect(selectLocator).not.toBeVisible();
        }
      }
    }

    await navigate(page, "/dashboard/media");
    const search = page.getByLabel("Zoeken in media");
    await expect(search).toBeVisible();
    expect((await search.boundingBox())?.height).toBe(44);
  }
});
