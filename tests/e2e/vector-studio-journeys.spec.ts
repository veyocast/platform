import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Vector Studio journeys", () => {
  test("shares one accessible journey language across Menu and Sportlink", async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ height: 900, width: 1440 });

    await page.goto("/dashboard/slides/menu-studio/new");
    await expect(page.getByRole("heading", { level: 1, name: "Menu & prijzen" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Voortgang" })).toContainText("Samenstellen");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "docs/screenshots/vector-v2/studio/menu-journey-1440x900.png"
    });

    await page.goto("/dashboard/studio/sportlink/new");
    await expect(page.getByRole("heading", { level: 1, name: "Wat wil je tonen?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Voortgang" })).toContainText("Thema & weergave");
    await expect(page.getByText("Live stijlpreview")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "docs/screenshots/vector-v2/studio/sportlink-journey-1440x900.png"
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.getByText("Live stijlpreview")).toBeVisible();
    const bounds = await page.evaluate(() => ({
      inner: window.innerWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "docs/screenshots/vector-v2/studio/sportlink-journey-390x844.png"
    });
  });

  test("keeps the honest RSS prerequisite reachable from Studio", async ({
    page
  }) => {
    await page.goto("/dashboard/studio/new");
    const newsCard = page
      .getByRole("heading", { name: "Nieuws & RSS" })
      .locator("xpath=ancestor::article[1]");
    const newsLink = newsCard.getByRole("link", { name: "Openen" });
    await expect(newsLink).toHaveAttribute("href", "/dashboard/slides/new?family=news");
    await newsLink.click();
    await expect(page).toHaveURL(/\/dashboard\/slides\/new\?family=news$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Nieuwsslide maken" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Eerst een RSS- of Atom-bron nodig" })).toBeVisible();

    const message = "De slide kon tijdelijk niet worden gemaakt.";
    await page.goto(
      `/dashboard/slides/new?family=news&fout=${encodeURIComponent(message)}`
    );
    await expect(page).toHaveURL(/family=news&fout=/);
    await expect(page.locator(".notice--critical[role=alert]")).toContainText(
      message
    );
  });
});
