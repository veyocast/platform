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

test("stuurt de oude slideflow door naar de Unified Studio", async ({ page }) => {
  await page.goto("/dashboard/slides/new", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/dashboard\/studio\/new$/, {
    timeout: 30_000
  });
  await expect(page.getByRole("heading", { level: 1, name: "Nieuwe slide" })).toBeVisible();
  await expect(
    page.locator("#control-content").getByRole("link", {
      exact: true,
      name: "Openen"
    })
  ).toHaveCount(5);
  for (const destination of [
    "/dashboard/studio/new?family=free",
    "/dashboard/slides/menu-studio/new",
    "/dashboard/slides/new?family=news",
    "/dashboard/studio/sportlink/new",
    "/dashboard/studio/sportlink/birthdays/new"
  ]) {
    await expect(page.locator(`a[href="${destination}"]`)).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Sportlink", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dynamische slide maken" })).toHaveCount(0);
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

test("toont de Sportlink-bulkwizard als Studio-familie", async ({ page }) => {
  await page.goto("/dashboard/studio/sportlink/new", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: "Inhoud kiezen" })).toBeVisible();
  for (const step of [
    "Inhoud kiezen",
    "Teams selecteren",
    "Competitie instellen",
    "Stijl en weergave",
    "Controleren"
  ]) {
    await expect(page.getByLabel("Voortgang")).toContainText(step);
  }
  await expect(page.getByText("Koppel en synchroniseer eerst Sportlink via Databronnen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Volgende" })).toBeDisabled();
});
