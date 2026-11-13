import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startS313BlogFixture } from "../helpers/s313-blog-fixture";

const evidence = join(process.cwd(), "docs/s313-blog-socialhero/evidence/browser");
let fixture: Awaited<ReturnType<typeof startS313BlogFixture>>;
const fingerprint = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 844 }];

test.describe.configure({ mode: "serial" });
test.use({ launchOptions: process.env.S313_BROWSER_EXECUTABLE ? { executablePath: process.env.S313_BROWSER_EXECUTABLE } : {} });
test.beforeAll(async () => {
  fixture = await startS313BlogFixture();
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, "provenance.json"), `${JSON.stringify({ ...fixture.provenance, fixtureOrigin: fixture.origin, capturedAtUtc: new Date().toISOString() }, null, 2)}\n`);
});
test.afterAll(async () => { if (fixture) await fixture.close(); });

async function settle(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) image.loading = "eager";
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
  });
}

async function metrics(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const main = document.querySelector("main");
    const h1 = document.querySelector("h1");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: rect(main), title: rect(h1),
      mainFont: main ? getComputedStyle(main).fontFamily : null,
      headingFont: h1 ? getComputedStyle(h1).fontFamily : null,
      headingCount: document.querySelectorAll("h1").length,
      headerCount: document.querySelectorAll("header.mk-header").length,
      footerCount: document.querySelectorAll("footer.mk-footer").length,
      images: [...document.querySelectorAll<HTMLImageElement>("main img")].map((image) => ({ alt: image.alt, loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, objectPosition: getComputedStyle(image).objectPosition })),
      navigation: [...document.querySelectorAll<HTMLAnchorElement>("header a")].map((link) => ({ text: link.textContent?.trim() || link.getAttribute("aria-label"), href: link.getAttribute("href") }))
    };
  });
}

test("captures the exact unchanged 4f44 marketing shell as a native baseline fixture", async ({ page }) => {
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${fixture.origin}/?variant=baseline`);
    await settle(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("header.mk-header")).toHaveCount(1);
    await expect(page.locator("footer.mk-footer")).toHaveCount(1);
    await expect(page.locator('header a[href="/blog"]')).toHaveCount(0);
    const measured = await metrics(page);
    expect(measured.overflow).toBeLessThanOrEqual(0);
    const name = `baseline-home-${viewport.width}.png`;
    const screenshot = await page.screenshot({ path: join(evidence, name), fullPage: true, animations: "disabled" });
    results.push({ source: "native baseline componentfixture, not Next runtime", screenshot: name, sha256: fingerprint(screenshot), ...measured });
  }
  await writeFile(join(evidence, "baseline.json"), `${JSON.stringify(results, null, 2)}\n`);
});

for (const viewport of viewports) {
  test(`compares supplied blog content at ${viewport.width}px and checks public semantics, reflow and axe`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const results = [];
    for (const view of ["index", "detail"]) {
      let prototype: Awaited<ReturnType<typeof metrics>> | undefined;
      let prototypePixels = "";
      for (const variant of ["prototype", "candidate"]) {
        await page.goto(`${fixture.origin}/?variant=${variant}&view=${view}`);
        await settle(page);
        const measured = await metrics(page);
        expect(measured.headingCount).toBe(1);
        expect(measured.headerCount).toBe(1);
        expect(measured.footerCount).toBe(1);
        expect(measured.overflow).toBeLessThanOrEqual(0);
        expect(measured.images.every((image) => image.loaded && image.alt.length > 0)).toBe(true);
        const name = `${variant}-${view}-${viewport.width}.png`;
        const screenshot = await page.screenshot({ path: join(evidence, name), fullPage: true, animations: "disabled" });
        const contentPixels = fingerprint(await page.locator("main").screenshot({ animations: "disabled" }));
        if (variant === "prototype") { prototype = measured; prototypePixels = contentPixels; }
        const axe = variant === "candidate" ? await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze() : null;
        results.push({ variant, view, source: "native componentfixture; real component/source CSS with readonly prototype dataset", screenshot: name, sha256: fingerprint(screenshot), mainPixelsSha256: contentPixels, ...measured, axeViolations: axe?.violations ?? null });
        if (variant === "candidate") {
          expect(measured.main).toEqual(prototype?.main);
          expect(measured.title).toEqual(prototype?.title);
          expect(measured.headingFont).toEqual(prototype?.headingFont);
          expect(contentPixels, "Candidate and supplied prototype main must have identical native screenshot pixels").toBe(prototypePixels);
          expect(axe?.violations).toEqual([]);
        }
      }
    }
    await writeFile(join(evidence, `comparison-${viewport.width}.json`), `${JSON.stringify(results, null, 2)}\n`);
  });
}

test("keeps the shared shell navigation and exposes real keyboard focus and mobile menu controls", async ({ page }) => {
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${fixture.origin}/?variant=candidate&view=detail`);
    await settle(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Direct naar inhoud" })).toBeFocused();
    const skipFocus = await page.getByRole("link", { name: "Direct naar inhoud" }).evaluate((element) => {
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return { visible: rect.top >= 0, href: element.getAttribute("href"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(skipFocus.visible).toBe(true);
    expect(skipFocus.href).toBe("#main-content");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => location.hash)).toBe("#main-content");
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Menu openen" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Menu sluiten" })).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator('header a[href="/blog"]')).toBeVisible();
      await page.screenshot({ path: join(evidence, "candidate-mobile-menu-focus.png"), animations: "disabled" });
    }
    results.push({ viewport, skipFocus, navigation: await metrics(page) });
  }
  await writeFile(join(evidence, "keyboard.json"), `${JSON.stringify(results, null, 2)}\n`);
});

test("checks the real isolated Next Marketing runtime when its test origin is supplied", async ({ page }) => {
  const origin = process.env.S313_BLOG_NEXT_URL;
  test.skip(!origin, "Open acceptance gate: supply the isolated Marketing Next runtime origin; fixtures do not prove runtime publication.");
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const response = await page.goto(`${origin}/blog`);
    expect(response?.status()).toBe(200);
    await settle(page);
    await expect(page.locator("h1")).toHaveText("Het VeyoCast-blog");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${origin}/blog`);
    await expect(page.locator("header.mk-header")).toHaveCount(1);
    await expect(page.locator("footer.mk-footer")).toHaveCount(1);
    await expect(page.locator('a[href="/website"]')).toHaveCount(0);
    const html = await response!.text();
    expect(html).toContain("Het VeyoCast-blog");
    expect(html).toContain(`href="${origin}/blog"`);
    const measured = await metrics(page);
    expect(measured.overflow).toBeLessThanOrEqual(0);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations).toEqual([]);
    const name = `next-blog-${viewport.width}.png`;
    await page.screenshot({ path: join(evidence, name), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Direct naar inhoud" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => location.hash)).toBe("#main-content");
    results.push({ source: "actual Next runtime", origin, screenshot: name, ...measured, axeViolations: axe.violations, keyboardSkipLink: "passed" });
  }
  const sitemap = await page.request.get(`${origin}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(`<loc>${origin}/blog</loc>`);
  const missing = await page.request.get(`${origin}/blog/s313-unpublished-does-not-exist`);
  expect(missing.status()).toBe(404);
  await writeFile(join(evidence, "next-runtime.json"), `${JSON.stringify(results, null, 2)}\n`);
});

test("captures the actual published prototype dataset after the real API and PostgreSQL acceptance chain", async ({ page }) => {
  const origin = process.env.S313_BLOG_NEXT_URL;
  test.skip(!origin || process.env.S313_BLOG_PUBLISHED_EVIDENCE !== "1", "Run the actual local API/PostgreSQL acceptance chain first, then opt in to its published dataset captures.");
  const report = JSON.parse(await readFile(join(evidence, "../integration/result.json"), "utf8")) as {
    steps: Array<{ name: string; result: { currentPublicUrl?: string; counts?: { posts: number; published: number } } }>;
  };
  const completed = report.steps.find((step) => step.name === "database-counts-and-final-canonical-sitemap")?.result;
  expect(completed?.counts).toMatchObject({ posts: 3, published: 3 });
  const detailUrl = completed?.currentPublicUrl;
  expect(detailUrl?.startsWith(`${origin}/blog/`)).toBe(true);
  if (!detailUrl) throw new Error("The real API acceptance report has no published article URL.");
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const view of ["index", "detail"]) {
      const response = await page.goto(view === "index" ? `${origin}/blog` : detailUrl);
      expect(response?.status()).toBe(200);
      await settle(page);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("header.mk-header")).toHaveCount(1);
      await expect(page.locator("footer.mk-footer")).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", view === "index" ? `${origin}/blog` : detailUrl);
      if (view === "index") {
        await expect(page.locator("main article")).toHaveCount(3);
      } else {
        await expect(page.locator("h1")).toHaveText("Zo richt je ClubTV in voor de wedstrijddag");
        await expect(page.locator('meta[name="socialhero:revision"]')).toHaveAttribute("content", "4");
        await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
        await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
      }
      const measured = await metrics(page);
      expect(measured.overflow).toBeLessThanOrEqual(0);
      expect(measured.images.every((image) => image.loaded && image.alt.length > 0)).toBe(true);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
      const name = `next-published-${view}-${viewport.width}.png`;
      const screenshot = await page.screenshot({ path: join(evidence, name), fullPage: true, animations: "disabled" });
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Direct naar inhoud" })).toBeFocused();
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => location.hash)).toBe("#main-content");
      results.push({ source: "actual Next runtime and actual API-published PostgreSQL dataset; local Auth/Storage test adapter", origin, view, screenshot: name, sha256: fingerprint(screenshot), ...measured, axeViolations: axe.violations, keyboardSkipLink: "passed" });
    }
  }
  await writeFile(join(evidence, "next-published-runtime.json"), `${JSON.stringify(results, null, 2)}\n`);
});
