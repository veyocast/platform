import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const liveStudio = process.env.VEYOCAST_LIVE_STUDIO_E2E === "1";

test.describe("Vector v2 live Studio journeys", () => {
  test.skip(!liveStudio, "requires an isolated local Supabase stack with the RSS fixture");
  test.setTimeout(90_000);

  test("opens a real RSS source in the shared journey without persisting a draft", async ({
    page
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/slides/new?family=news");
    await expect(page.getByRole("heading", { level: 1, name: "Nieuwsslide maken" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Voortgang" })).toContainText("Kleuren & uitstraling");
    await page.getByLabel("Naam van de slide").fill("Clubnieuws scherm");
    await page.getByRole("button", { name: /Volgende/ }).click();
    await expect(page.getByRole("heading", { name: "Kies een template" })).toBeVisible();
    await page.getByRole("button", { name: /Volgende/ }).click();
    await expect(page.getByRole("heading", { name: "Kies een databron" })).toBeVisible();
    await expect(page.getByLabel("Databron")).toHaveValue("a1234567-89ab-4cde-8f01-23456789abcd");
    await expect(page.locator("strong:visible", { hasText: "Clubnieuws" }).first()).toBeVisible();
    await expect(page.locator("h2:visible", { hasText: "Nieuwe jeugdtribune geopend" }).first()).toBeVisible({
      timeout: 15_000
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "docs/screenshots/vector-v2/studio/rss-journey-live-1440x900.png"
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Nieuwsslide maken" })).toBeVisible();
    const bounds = await page.evaluate(() => ({
      inner: window.innerWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "docs/screenshots/vector-v2/studio/rss-journey-live-390x844.png"
    });
  });

  test("persists a real news slide from the final review step", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/slides/new?family=news");
    await page.getByLabel("Naam van de slide").fill("Clubnieuws opslagtest");
    for (const heading of [
      "Kies een template",
      "Kies een databron",
      "Configureer de inhoud",
      "Kies kleuren en uitstraling",
      "Controleer en maak de slide"
    ]) {
      await page.getByRole("button", { name: /Volgende/ }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    const create = page.getByRole("button", { name: "Slide maken" });
    await expect(create).toBeEnabled({ timeout: 15_000 });
    await create.click();
    await page.waitForURL(/\/dashboard\/slides\/[0-9a-f-]+\?succes=/, {
      timeout: 30_000
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Clubnieuws opslagtest" })
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "De eerste immutable snapshot wordt gerenderd."
    );
  });
});
