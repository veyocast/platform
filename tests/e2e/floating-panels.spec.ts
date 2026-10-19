import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1024 },
  { height: 900, width: 1440 }
] as const;

async function triggerInsideViewport(page: Page) {
  const trigger = page.getByRole("button", { name: "Actieve context: Museumkwartier" });
  if (!(await trigger.isVisible())) return false;
  const box = await trigger.boundingBox(), viewport = page.viewportSize();
  return Boolean(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height);
}

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
      page.getByRole("heading", { level: 1, name: /Mooi dat je er bent,/ })
    ).toBeVisible();

    const contextTrigger = page.getByRole("button", {
      name: "Actieve context: Museumkwartier"
    });
    if (await triggerInsideViewport(page)) {
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
    if (!(await triggerInsideViewport(page))) {
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
          /\bopen\b/
        );
        await expect(contextTrigger).toBeVisible();
      }).toPass({ timeout: 20_000 });
    }

    await contextTrigger.scrollIntoViewIfNeeded();
    await expect.poll(() => triggerInsideViewport(page)).toBe(true);
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

test("het volledige Beheer-paneel blijft bereikbaar op echte mobiele viewports", async ({page}) => {
  test.setTimeout(90_000);
  for (const viewport of [{height: 640, width: 360}, {height: 844, width: 390}, {height: 915, width: 412}, {height: 1024, width: 768}]) {
    await page.setViewportSize(viewport);
    await openDashboard(page);
    if (viewport.width <= 760) await page.getByRole("button", {name: "Navigatie openen"}).click();
    const sidebar = page.getByLabel("Control navigatie");
    await expect(sidebar).toBeVisible();
    const footer = sidebar.locator(".vx-side-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    const footerBox = await footer.boundingBox();
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    const trigger = sidebar.getByRole("button", {name: "Beheer", exact: true});
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const panel = page.getByRole("dialog", {name: "Beheer je werkplek", exact: true});
    await expect(panel).toBeVisible();
    const last = panel.getByRole("link").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    const lastBox = await last.boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (viewport.width <= 760) {
      await expect(sidebar).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sidebar).not.toBeVisible();
      await expect(page.getByRole("button", {name: "Navigatie openen"})).toBeFocused();
    }
  }
});
