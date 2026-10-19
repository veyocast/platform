import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

async function assertNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    controls: [...document.querySelectorAll<HTMLElement>("main button, main select, main input:not([type=hidden]), main textarea")]
      .filter(element => element.checkVisibility())
      .map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }))
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.controls.length).toBeGreaterThan(5);
  for (const control of dimensions.controls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(dimensions.viewport);
  }
}

async function assertTargets(page: Page, selector: string) {
  const sizes = await page.locator(selector).evaluateAll(elements => elements
    .filter(element => (element as HTMLElement).checkVisibility())
    .map(element => ({ name: element.textContent || element.getAttribute("aria-label"), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
  expect(sizes.length).toBeGreaterThan(5);
  for (const size of sizes) {
    expect(size.width, `${size.name}: width`).toBeGreaterThanOrEqual(44);
    expect(size.height, `${size.name}: height`).toBeGreaterThanOrEqual(44);
  }
}

for (const width of [390, 1440]) {
  test.describe(`Source public setup at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("keeps the old hash handoff, one native chrome and keyboard navigation", async ({ page }, testInfo) => {
      await page.goto(`${marketingURL}/#opstelling`);
      await expect(page).toHaveURL(`${marketingURL}/opstelling#opstelling`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bouw je VeyoCast-opstelling.");
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      await expect(page.locator(".mk-header .brand")).toHaveAttribute("src", "/assets/full-dark.svg");
      await expect(page.locator("[data-sites=hero-stage], .prototype-home, .mk-hero")).toHaveCount(0);
      const nav = page.getByRole("navigation", { name: "Publieke hoofdnavigatie", exact: true });
      if (width === 390) {
        await expect(nav).toBeHidden();
        await page.getByRole("button", { name: "Menu openen" }).click();
        await expect(nav.getByRole("link", { name: "Platform", exact: true })).toBeFocused();
      }
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "Platform", exact: true })).toHaveAttribute("href", "/functies/");
      await nav.locator("summary").click();
      await expect(nav.getByRole("link", { name: "Sportverenigingen", exact: true })).toHaveAttribute("href", "/oplossingen/sportverenigingen/");
      await page.keyboard.press("Escape");
      await expect(nav.locator("details")).not.toHaveAttribute("open", "");
      await expect(nav.locator("summary")).toBeFocused();
      if (width === 390) {
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Menu openen" })).toBeFocused();
        await expect(nav).toBeHidden();
      }
      await assertTargets(page, ".mk-header a, .mk-header button, .mk-header summary, .mk-footer a, main button, main select");
      await assertNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("setup-native.png"), fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test("carries the complete real setup through the unchanged signed server action", async ({ page }) => {
      await page.goto(`${marketingURL}/opstelling#opstelling`);
      const summary = page.getByRole("complementary", { name: "Samenvatting van je opstelling" });
      await expect(summary.getByRole("heading", { name: "1 scherm", exact: true })).toBeVisible();
      await page.getByRole("button", { name: /Horeca/ }).click();
      if (width === 390) await page.getByRole("button", { name: "Volgende", exact: true }).click();
      const removeEntrance = page.getByRole("button", { name: "Scherm verwijderen uit Entree & ontvangst" });
      await expect(removeEntrance).toBeDisabled();
      const addClubhouse = page.getByRole("button", { name: "Scherm toevoegen aan Kantine & ontmoetingsplek" });
      await addClubhouse.click();
      await addClubhouse.click();
      await page.getByRole("article").filter({ hasText: "Kantine & ontmoetingsplek" }).getByRole("combobox").selectOption("menu");
      await expect(summary.getByRole("heading", { name: "3 schermen", exact: true })).toBeVisible();
      await expect(summary.getByText("€ 17,85", { exact: true })).toBeVisible();
      if (width === 390) await page.getByRole("button", { name: "Volgende", exact: true }).click();
      await expect(page.getByRole("button", { name: /Sportlink/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: /YouTube/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: /Engage/ })).toBeDisabled();
      await page.getByRole("button", { name: /RSS/ }).click();
      const setup = JSON.parse(await page.locator('input[name="setup"]').inputValue());
      expect(setup).toEqual({ branch: "hospitality", modules: ["own-media", "sponsors", "rss"], zones: [
        { id: "entrance", count: 1, goal: "welcome" },
        { id: "clubhouse", count: 2, goal: "menu" },
        { id: "main", count: 0, goal: "live-info" },
        { id: "boardroom", count: 0, goal: "internal" }
      ] });
      await assertNoOverflow(page);
      await summary.getByRole("button", { name: "Neem deze opstelling mee" }).click();
      await expect(page).toHaveURL(/\/demo\?setup=/);
      await expect(page.getByText("Je opstelling is meegenomen: 3 schermen.")).toBeVisible();
      await expect(page.locator('input[name="setupIntent"]')).toHaveValue(/.+/);
      await expect(page.locator('select[name="organizationType"]')).toHaveValue("Horeca");
      await expect(page.locator('select[name="screens"]')).toHaveValue("1–3");
    });

    test("keeps actual demo fields readable and recovers invalid setup without sending a request", async ({ page }, testInfo) => {
      const submissions: string[] = [];
      page.on("request", request => { if (request.method() === "POST") submissions.push(new URL(request.url()).pathname); });
      await page.goto(`${marketingURL}/demo?setup=invalid.intent`);
      const form = page.locator(".mk-form-card form");
      await expect(form.getByRole("alert")).toContainText("De meegenomen opstelling is verlopen of ongeldig.");
      await expect(page.locator('input[name="setupIntent"]')).toHaveCount(0);
      await page.getByLabel("Je naam", { exact: true }).fill("Eigen testpersoon");
      await form.getByRole("button", { name: "Demo aanvragen" }).click();
      await expect(page.getByLabel("Je naam", { exact: true })).toHaveValue("Eigen testpersoon");
      await expect(page.locator(".mk-form-success")).toHaveCount(0);
      expect(await page.getByLabel("E-mailadres", { exact: true }).evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
      expect(submissions).toEqual([]);
      const fontSizes = await page.locator(".mk-form-fields label, .mk-form-fields input:not([type=checkbox]), .mk-form-fields select, .mk-form-fields textarea, .mk-form-heading p, .mk-form-heading small, .mk-privacy-notice p, .mk-demo-notice p, .mk-demo-notice strong").evaluateAll(elements => elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
      expect(fontSizes.length).toBeGreaterThan(10);
      for (const size of fontSizes) expect(size).toBeGreaterThanOrEqual(14);
      await assertTargets(page, ".mk-form-fields input:not([type=checkbox]), .mk-form-fields select, .mk-form-fields textarea, .mk-form-fields .mk-check, .mk-form-fields button, .mk-check a, .mk-privacy-notice a");
      await assertNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("demo-readable.png"), fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  });
}
