import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Actual local Next shell and route handlers in development demo mode. It has
// no tenant data or mutation permission; object identity is separately tested
// against the canonical mapper and authorized server-query boundary.
for (const width of [320, 768, 1280]) {
  test(`one Content entry retains URL state and reachable management at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/content?filter=menus&status=archive&q=Club&page=2&pageSize=24", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Contentbibliotheek", exact: true })).toBeVisible();
    const types = page.getByRole("navigation", { name: "Contenttype", exact: true });
    await expect(types.getByRole("link")).toHaveText([/Alles/, "Media", "Ontwerpen", "Automatische slides", "Menu’s", "Reeksen"]);
    await expect(types.getByRole("link", { name: "Menu’s", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Contentstatus", exact: true }).getByRole("link", { name: "Archief", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("textbox", { name: "Zoek content" })).toHaveValue("Club");
    const media = types.getByRole("link", { name: "Media", exact: true });
    await expect(media).toHaveAttribute("href", "/dashboard/content?filter=media&status=archive&page=1&q=Club&pageSize=24");
    await media.click();
    await expect(page).toHaveURL(/filter=media&status=archive&page=1&q=Club&pageSize=24/);
    await expect(page.getByRole("link", { name: "Mappen, tags en mediaverwerking", exact: true })).toHaveAttribute("href", "/dashboard/media");
    await page.getByRole("textbox", { name: "Zoek content" }).fill("Nieuwe club");
    await page.getByRole("textbox", { name: "Zoek content" }).press("Enter");
    await expect(page).toHaveURL(/filter=media&status=archive&pageSize=24&q=Nieuwe\+club/);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Contentbibliotheek", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Zoek content" })).toHaveValue("Nieuwe club");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const link of await types.getByRole("link").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await info.attach(`content-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    if (process.env.S297_CAPTURE_DIR) { await mkdir(process.env.S297_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.S297_CAPTURE_DIR, `content-${width}.png`), fullPage: true }); }
    expect((await new AxeBuilder({ page }).include("#control-content").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  });
}

test("old equivalent index links retain search, archived selection and menu pagination", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/dashboard/slides/menu-studio?pagina=2", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/content\?filter=menus&status=active&page=2&pageSize=24$/, { timeout: 30000 });
  await page.goto("/dashboard/studio?q=Oud+team&status=archived", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/content\?filter=designs&status=archive&page=1&q=Oud\+team$/, { timeout: 30000 });
  await page.goto("/dashboard/studio?owner=mine&format=portrait&status=deleted&q=Eigen", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/studio\?advanced=1&format=portrait&owner=mine&q=Eigen&status=deleted$/, { timeout: 30000 });
  await expect(page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", { name: "Content", exact: true })).toHaveAttribute("aria-current", "page");
});

test("the shared chooser route opens directly and legacy media remains contextual", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard/studio/new", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/studio\/new$/);
  const chooser = page.getByRole("dialog", { name: "Wat wil je maken?" });
  await expect(chooser).toBeVisible();
  await expect(chooser.locator(".vc-template-card > span > strong").filter({ hasText: /^Uitslagen$/ })).toHaveCount(1);
  await info.attach("shared-chooser-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  if (process.env.S297_CAPTURE_DIR) { await mkdir(process.env.S297_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.S297_CAPTURE_DIR, "shared-chooser-desktop.png"), fullPage: true }); }
  await page.keyboard.press("Escape");
  await page.goto("/dashboard/content?filter=media", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Mappen, tags en mediaverwerking", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/media$/);
  await expect(page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", { name: "Content", exact: true })).toHaveAttribute("aria-current", "page");
});
