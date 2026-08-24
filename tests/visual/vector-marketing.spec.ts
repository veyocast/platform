import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const evidenceEnabled = process.env.VEYOCAST_VECTOR_MARKETING_EVIDENCE === "1";
const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;
const evidenceDirectory = path.resolve("docs/screenshots/vector-v2/marketing");

const viewports = [
  { height: 1080, name: "1920x1080", width: 1920 },
  { height: 900, name: "1440x900", width: 1440 },
  { height: 800, name: "1280x800", width: 1280 },
  { height: 768, name: "1024x768", width: 1024 },
  { height: 844, name: "390x844", width: 390 }
] as const;

const routes = [
  { name: "home", pathname: "/" },
  { name: "pricing", pathname: "/prijzen" },
  { name: "demo", pathname: "/demo" }
] as const;

test.describe("Vector v2 marketing evidence", () => {
  test.skip(!evidenceEnabled, "requires explicit Vector marketing evidence opt-in");
  test.setTimeout(180_000);

  test("captures the public journey at every canonical viewport", async ({ page }) => {
    mkdirSync(evidenceDirectory, { recursive: true });
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        const response = await page.goto(`${marketingURL}${route.pathname}`, {
          waitUntil: "networkidle"
        });
        expect(response?.status(), route.pathname).toBe(200);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await expect(page.locator("h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
          ),
          `${route.pathname} at ${viewport.name}`
        ).toBe(true);
        await page.screenshot({
          path: path.join(evidenceDirectory, `${route.name}-${viewport.name}.png`)
        });
      }
    }

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(`${marketingURL}/#opstelling`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.locator("#opstelling").screenshot({
      path: path.join(evidenceDirectory, "setup-builder-1440x900.png")
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`${marketingURL}/#opstelling`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const stepper = page.getByRole("navigation", { name: "Stappen van de setup builder" });
    await stepper.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidenceDirectory, "setup-builder-mobile-location.png") });
    await stepper.getByRole("button", { name: "2 Schermen" }).click();
    await page.screenshot({ path: path.join(evidenceDirectory, "setup-builder-mobile-screens.png") });
    await stepper.getByRole("button", { name: "3 Bronnen" }).click();
    await page.screenshot({ path: path.join(evidenceDirectory, "setup-builder-mobile-sources.png") });
  });
});
