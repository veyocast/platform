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

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: "Overzicht" })
    ).toBeVisible();

    const contextTrigger = page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    });
    if (await contextTrigger.isVisible()) {
      await expect(contextTrigger).toBeEnabled();
      return;
    }

    const mobileMoreTrigger = page.getByRole("button", { name: "Meer" });
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
      const mobileMoreTrigger = page.getByRole("button", { name: "Meer" });
      const navigationTrigger = (await mobileMoreTrigger.isVisible())
        ? mobileMoreTrigger
        : page.getByRole("button", { name: "Navigatie openen" });
      await expect(navigationTrigger).toBeEnabled();
      await navigationTrigger.click();
      await expect(contextTrigger).toBeVisible();
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
