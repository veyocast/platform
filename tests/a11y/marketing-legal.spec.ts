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

    await expect(page.locator("html")).toHaveAttribute("lang", "nl");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", {
      exact: true,
      level: 1,
      name: legalPage.heading
    })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Naar de inhoud" })).toBeAttached();

    const headingLevelJumps = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((headings) => {
        const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
        return levels.some((level, index) => index > 0 && level > levels[index - 1]! + 1);
      });
    expect(headingLevelJumps).toBe(false);
  });
}
