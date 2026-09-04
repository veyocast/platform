import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1024 },
  { height: 900, width: 1440 }
] as const;

async function openDashboard(page: Page) {
  await expect(async () => {
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    } catch (error) {
      // Next dev can replace the first navigation while compiling a lazy
      // App Router segment. A real page failure still fails the assertions.
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { level: 1, name: /Goedemorgen,/ })
    ).toBeVisible();

    const contextTrigger = page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    });
    if (await contextTrigger.isVisible()) {
      await expect(contextTrigger).toBeEnabled();
      return;
    }

    const mobileMoreTrigger = page.getByRole("button", {
      exact: true,
      name: "Meer"
    });
    const navigationTrigger = (await mobileMoreTrigger.isVisible())
      ? mobileMoreTrigger
      : page.getByRole("button", { name: "Navigatie openen" });
    await expect(navigationTrigger).toBeEnabled();
  }).toPass({ timeout: 20_000 });
}

test("floating panels stay above clipped containers at every Control breakpoint", async ({
  page
}) => {
  test.setTimeout(90_000);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openDashboard(page);

    const contextTrigger = page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    });
    if (!(await contextTrigger.isVisible())) {
      await expect(async () => {
        const mobileMoreTrigger = page.getByRole("button", {
          exact: true,
          name: "Meer"
        });
        const navigationTrigger = (await mobileMoreTrigger.isVisible())
          ? mobileMoreTrigger
          : page.getByRole("button", { name: "Navigatie openen" });
        await expect(navigationTrigger).toBeEnabled();
        await navigationTrigger.click();
        await expect(page.locator("#control-sidebar-navigation")).toHaveClass(
          /control-sidebar--open/
        );
        await expect(contextTrigger).toBeVisible();
      }).toPass({ timeout: 20_000 });
    }

    await contextTrigger.click();
    const panel = page.locator("[data-floating-panel]");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-ready", "true");

    const geometry = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        parentIsBody: element.parentElement === document.body,
        position: getComputedStyle(element).position,
        right: rect.right,
        top: rect.top,
        zIndex: Number(getComputedStyle(element).zIndex)
      };
    });

    expect(geometry.parentIsBody).toBe(true);
    expect(geometry.position).toBe("fixed");
    expect(geometry.zIndex).toBeGreaterThanOrEqual(300);
    expect(geometry.left).toBeGreaterThanOrEqual(12);
    expect(geometry.right).toBeLessThanOrEqual(viewport.width - 12);
    expect(geometry.top).toBeGreaterThanOrEqual(12);
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height - 12);

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(contextTrigger).toBeFocused();
  }
});

test("het volledige Meer-paneel blijft bereikbaar op echte mobiele viewports", async ({ page }) => {
  test.setTimeout(90_000);
  const mobileViewports = [
    { height: 640, width: 360 },
    { height: 844, width: 390 },
    { height: 915, width: 412 },
    { height: 1024, width: 768 }
  ];

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await openDashboard(page);
    const more = page.getByRole("button", { exact: true, name: "Meer" });
    const trigger = await more.isVisible()
      ? more
      : page.getByRole("button", { name: "Navigatie openen" });
    await trigger.click();

    const sidebar = page.locator("#control-sidebar-navigation");
    await expect(sidebar).toHaveClass(/control-sidebar--open/);
    const footer = sidebar.locator(".control-sidebar__footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    const bounds = await footer.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.keyboard.press("Escape");
  }
});
