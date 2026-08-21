import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.MENU_STUDIO_E2E === "1";
const sourceId = "30000000-0000-4000-8000-000000000101";

test.describe("Menu Studio v2 live toegankelijkheids- en interactiepad", () => {
  test.skip(!enabled, "vereist een expliciet ingeschakelde lokale Supabase-fixture");
  test.use({ serviceWorkers: "block" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    const { url } = publicConfig();
    if (!/^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
      throw new Error("Menu Studio E2E weigert iedere niet-lokale Supabase-omgeving.");
    }
  });

  test("maakt, groepeert, bedient met toetsenbord en publiceert desktop en mobiel", async ({ browser, page }) => {
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(60_000);
    await authenticate(page);
    await page.setViewportSize({ height: 960, width: 1440 });
    await page.goto("/dashboard/slides");
    await expect(page.getByRole("link", { name: "Menu Studio openen" })).toHaveAttribute(
      "href",
      "/dashboard/slides/menu-studio/new"
    );
    await expect(page.getByRole("link", { name: "Nieuwe dynamische slide" })).toHaveCount(0);
    await page.goto(`/dashboard/slides/menu-studio/new?bron=${sourceId}`);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    await expect(page.getByRole("heading", { level: 1, name: "Menu Studio" })).toBeVisible();
    await expect(page.getByText("Live MenuScene")).toBeVisible();
    await expect(page.locator('[data-hydrated="true"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-menu-scene-scale]")).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Liggend" })).toHaveAttribute("aria-pressed", "true");
    const canvasDropTarget = page.getByRole("region", {
      name: "Compositiecanvas; sleep hier categorieën, producten en media naartoe"
    });
    const categoryButton = page.getByRole("button", { name: /Frisdranken Sleep of voeg toe/ });
    await dragThroughBrowserDnd(page, categoryButton, canvasDropTarget);
    await expect(page.getByRole("button", { name: /Frisdranken Geplaatst/ })).toBeDisabled();
    const regularCardBeforeDrop = productCard(page, "Coca-Cola Regular");
    await dragThroughBrowserDnd(page, regularCardBeforeDrop.locator("button").first(), canvasDropTarget);
    await expect(regularCardBeforeDrop).toHaveAttribute("data-selected", "true");
    await addProduct(page, "Coca-Cola Zero");
    await addProduct(page, "Coca-Cola Cherry");

    const regularCard = productCard(page, "Coca-Cola Regular");
    const groupButton = regularCard.getByRole("button", { name: "Maak productgroep" });
    await expect(groupButton).toBeVisible();
    await groupButton.click();
    await expect(page.getByRole("region", { name: /Productgroep Coca-Cola Regular bewerken/ })).toBeVisible();
    await removeProduct(page, "Coca-Cola Zero");
    await removeProduct(page, "Coca-Cola Cherry");
    await productCard(page, "Coca-Cola Zero").getByRole("button", { name: "Koppel aan actieve groep" }).click();
    const groupDropTarget = page.getByRole("region", {
      name: "Sleep een product of vrije subregel naar deze productgroep"
    });
    await dragThroughBrowserDnd(page, productCard(page, "Coca-Cola Cherry").locator("button").first(), groupDropTarget);
    await expect(productCard(page, "Coca-Cola Cherry")).toHaveAttribute("data-selected", "true");
    await removeProduct(page, "Coca-Cola Zero");
    await expect(page.getByRole("region", { name: /Productgroep Coca-Cola Regular bewerken/ })).toBeVisible();
    await productCard(page, "Coca-Cola Zero").getByRole("button", { name: "Koppel aan actieve groep" }).click();
    const groupInspector = page.getByRole("region", { name: /Productgroep Coca-Cola Regular bewerken/ });
    await dragThroughBrowserDnd(page, page.getByRole("button", { name: "Vrije subregel" }), groupDropTarget);
    const freeInput = groupInspector.locator("input").last();
    await expect(freeInput).toHaveValue("Vrije invoer");
    await freeInput.fill("Ook zonder suiker");
    await freeInput.blur();
    await expect(groupInspector.locator("input").last()).toHaveValue("Ook zonder suiker");

    const dragHandle = page.getByRole("button", { name: /Versleep Frisdranken/ });
    await dragHandle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(dragHandle).toBeFocused();

    await page.getByRole("button", { name: "Staand" }).click();
    const scene = page.locator("[data-theme-mode][data-theme-id]");
    await expect(scene).toHaveAttribute("data-orientation", "portrait");
    const sceneBox = await scene.boundingBox();
    expect(sceneBox && sceneBox.width / sceneBox.height).toBeCloseTo(9 / 16, 2);
    await page.getByRole("button", { name: "obsidian" }).click();
    await expect(scene).toHaveAttribute("data-theme-id", "obsidian");
    await expectNoSeriousAxeViolations(page);

    await page.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s112-menu-studio-desktop.png")
    });
    await page.getByRole("button", { name: "Concept opslaan" }).click();
    await expect(page).toHaveURL(/\/dashboard\/slides\/menu-studio\/[0-9a-f-]+/);
    await expect(page.getByRole("button", { name: "Publiceren" })).toBeEnabled();
    await page.getByRole("button", { name: "Publiceren" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Immutable release aangemaakt" })).toBeVisible();

    const editorUrl = page.url();
    const mobileContext = await browser.newContext({
      baseURL: new URL(editorUrl).origin,
      hasTouch: true,
      serviceWorkers: "block",
      viewport: { height: 844, width: 390 }
    });
    const mobilePage = await mobileContext.newPage();
    await authenticate(mobilePage);
    await mobilePage.goto(editorUrl);
    await mobilePage.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(mobilePage.getByRole("navigation", { name: "Mobiele Menu Studio-panelen" })).toBeVisible();
    await mobilePage.getByRole("button", { name: "Opbouw", exact: true }).tap();
    await mobilePage.getByRole("button", { name: "Coca-Cola Regular bewerken" }).tap();
    const mobileFreeInput = mobilePage.getByRole("region", { name: /Productgroep Coca-Cola Regular bewerken/ })
      .locator("input")
      .last();
    await expect(mobileFreeInput).toHaveValue("Ook zonder suiker");
    await mobileFreeInput.fill("Ook mobiel bewerkbaar");
    await mobileFreeInput.blur();
    await expect(mobileFreeInput).toHaveValue("Ook mobiel bewerkbaar");
    await mobilePage.getByRole("button", { name: "Bibliotheek", exact: true }).tap();
    await expect(mobilePage.getByRole("heading", { name: "Bibliotheek" })).toBeVisible();
    expect(await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).toBe(true);
    for (const control of await mobilePage.getByRole("navigation", { name: "Mobiele Menu Studio-panelen" }).getByRole("button").all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await expectNoSeriousAxeViolations(mobilePage);
    await mobilePage.screenshot({
      fullPage: true,
      path: path.resolve("docs/screenshots/s112-menu-studio-mobile.png")
    });
    await mobileContext.close();
  });
});

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .include('[data-hydrated="true"]')
    .analyze();
  expect(result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious"
  )).toEqual([]);
}

async function dragThroughBrowserDnd(
  page: Page,
  source: Locator,
  target: Locator
) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragenter", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}

function productCard(page: Page, name: string) {
  return page.locator("article").filter({ has: page.getByText(name, { exact: true }) }).last();
}

async function addProduct(page: Page, name: string) {
  const card = productCard(page, name);
  await card.locator("button").first().click();
  await expect(card).toHaveAttribute("data-selected", "true");
}

async function removeProduct(page: Page, name: string) {
  const card = productCard(page, name);
  await card.locator("button").first().click();
  await expect(card).toHaveAttribute("data-selected", "false");
}

async function authenticate(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
  await page.getByLabel("Wachtwoord").fill("veyocast-local");
  await page.getByRole("button", { name: "Doorgaan" }).click();
  await expect(page).toHaveURL(/\/(?:context|dashboard)(?:\?|$)/, { timeout: 20_000 });
  if (/\/context(?:\?|$)/.test(page.url())) {
    await page.getByRole("button", { name: "Open vereniging" }).click();
  }
  await expect(page).toHaveURL(/\/dashboard$/);
}

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Lokale publieke Supabase-configuratie ontbreekt.");
  return { anonKey, url };
}
