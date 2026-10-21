import { expect, test } from "@playwright/test";

test("onderscheidt opgeslagen bronnen van een nog niet verbonden provider", async ({page}) => {
  await page.goto("/dashboard/data-sources", {waitUntil: "networkidle"});
  await expect(page.getByRole("heading", {name: "Alles begint bij goede gegevens."})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Nog geen bronnen verbonden"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Bron toevoegen", exact: true})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "Bron toevoegen", exact: true})).toHaveCount(0);
  await expect(page.locator(".ad-source-grid > a")).toHaveCount(0);
  await page.goto("/dashboard/sources/sportlink");
  await expect(page.getByRole("heading", {name: "Sportlink Club.Dataservice", exact: true})).toBeVisible();
});

test("stuurt de oude slideflow door naar de Unified Studio", async ({ page }) => {
  await page.goto("/dashboard/slides/new", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/dashboard\/studio\/new$/, {
    timeout: 30_000
  });
  const picker = page.getByRole("dialog", {name: "Wat wil je maken?"});
  await expect(picker).toBeVisible();
  for (const name of ["Alles", "Sport", "Kantine", "Club", "Media", "Vrij"]) {
    await expect(picker.locator(".vc-modal-family-tabs").getByRole("button", {name, exact: true})).toBeVisible();
  }
  await expect(picker.locator(".vc-template-card")).toHaveCount(36);
  // NoDB has no authenticated writer. The genuine Source choices stay visible
  // while every write is denied; authenticated creation is a separate gate.
  await expect(picker.locator(".vc-template-card:disabled")).toHaveCount(36);
  for (const name of [/^Programma /, /^Kantinemenu /, /^Nieuws & RSS /, /^Verjaardagen /, /^YouTube /, /^Vrij ontwerp /]) {
    await expect(picker.getByRole("button", {name})).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(picker).not.toBeVisible();
  await expect(page.getByRole("heading", {level: 1, name: "Nieuw ontwerp", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dynamische slide maken" })).toHaveCount(0);
});

test("houdt de dynamische-slide lege staat vrij van de containerrand", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/slides", { waitUntil: "networkidle" });

  const emptyState = page.locator(".empty-state");
  const heading = page.getByRole("heading", {
    name: "Geen passende slides"
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

  await expect(page.getByRole("heading", { name: "De club, altijd in beeld." })).toBeVisible();
  for (const step of [
    "Inhoud kiezen",
    "Teams & gegevens",
    "Vormgeving",
    "Opslaan",
    "Controleren"
  ]) {
    await expect(page.getByRole("navigation", {name:"Sportlink-wizardstappen"})).toContainText(step);
  }
  await expect(page.getByText("Koppel en synchroniseer eerst Sportlink via Databronnen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Volgende" })).toBeDisabled();
});
