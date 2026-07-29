import { expect, test } from "@playwright/test";

test("maakt Sportlink vindbaar vanuit databronnen", async ({
  page
}) => {
  await page.goto("/dashboard/data-sources", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("link", { name: "Sportlink koppelen" })
  ).toBeVisible();
  await expect(
    page.getByText("Maak hieronder een productbron, veilige RSS-feed of Sportlink-koppeling.")
  ).toBeVisible();
});

test("maakt Sportlink vindbaar vanuit de slideflow", async ({ page }) => {
  await page.goto("/dashboard/slides/new", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Eerst een databron nodig" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sportlink koppelen" })
  ).toBeVisible();
});

test("houdt de dynamische-slide lege staat vrij van de containerrand", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/slides", { waitUntil: "networkidle" });

  const emptyState = page.locator(".empty-state");
  const heading = page.getByRole("heading", {
    name: "Nog geen dynamische slides"
  });
  await expect(emptyState).toBeVisible();
  await expect(heading).toBeVisible();

  await expect(async () => {
    const padding = await emptyState.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        left: Number.parseFloat(style.paddingLeft),
        top: Number.parseFloat(style.paddingTop)
      };
    });
    expect(padding.left).toBeGreaterThanOrEqual(20);
    expect(padding.top).toBeGreaterThanOrEqual(20);
  }).toPass();
});
