import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

for (const legalPage of [
  {
    heading: "Privacyverklaring",
    path: "/privacy"
  },
  {
    heading: "Data verwijderen",
    path: "/data-verwijderen"
  }
]) {
  test(`${legalPage.heading} exposes accessible Dutch landmarks`, async ({ page }) => {
    await page.goto(`${marketingURL}${legalPage.path}`);

    await expect(page.locator("html")).toHaveAttribute("lang", /^nl/);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", {
      exact: true,
      level: 1,
      name: legalPage.heading
    })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const skip = page.getByRole("link", { exact: true, name: "Direct naar inhoud" });
    await expect(skip).toBeAttached();
    await expect(skip).toHaveAttribute("href", "#main-content");
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("main#main-content")).toBeVisible();

    const headingLevelJumps = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((headings) => {
        const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
        return levels.some((level, index) => index > 0 && level > levels[index - 1]! + 1);
      });
    expect(headingLevelJumps).toBe(false);
  });
}
