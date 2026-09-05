import { expect, test } from "@playwright/test";

const livePilotEnabled = process.env.VEYOCAST_LIVE_PILOT === "1";
const validPngFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.setTimeout(120_000);

test.describe("guided Publisher journey", () => {
  test.skip(!livePilotEnabled, "requires local Supabase and explicit live pilot environment");

  test("publishes one immutable release after all five impact steps", async ({ page }) => {
    const suffix = Date.now();
    const assetTitle = `Vector publicatiebeeld ${suffix}`;
    const playlistName = `Vector publicatiereis ${suffix}`;

    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/media?upload=1");
    await page.getByLabel("Titel voor één afbeelding", { exact: true }).fill(assetTitle);
    await page.getByLabel("Afbeeldingen", { exact: true }).setInputFiles({
      buffer: validPngFixture,
      mimeType: "image/png",
      name: "vector-publisher.png"
    });
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText(`${assetTitle} is gecontroleerd`)).toBeVisible();

    await page.goto("/dashboard/playlists");
    await page.getByRole("button", { name: "Nieuwe playlist" }).click();
    const dialog = page.getByRole("dialog", { name: "Nieuwe playlist" });
    await dialog.getByLabel("Playlistnaam").fill(playlistName);
    await dialog.getByRole("button", { name: "Concept maken" }).click();
    await expect(page.getByText("De conceptplaylist is gemaakt")).toBeVisible();
    await page
      .getByRole("list", { name: "Gereedstaande inhoud" })
      .getByRole("listitem")
      .filter({ hasText: assetTitle })
      .getByRole("button", { name: `Toevoegen: ${assetTitle}` })
      .click();
    await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();

    await page.getByRole("link", { name: "Publiceren" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${playlistName} publiceren` })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Concept controleren" })).toBeVisible();
    await expect(page.getByLabel("Publicatie-impact")).toContainText("De huidige release blijft spelen");

    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Playerpreview" })).toBeVisible();
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Doelschermen kiezen" })).toBeVisible();
    await page.getByLabel(/Pilot hoofdscherm/).check();
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Preflight per scherm" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Pilot hoofdscherm" })).toContainText(/Onbekend|Waarschuwing|Gereed/);
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Impact bevestigen" })).toBeVisible();
    await page.getByLabel(/waarschuwingen en onbekende telemetry/i).check();
    await page.getByLabel(/Maak één nieuwe immutable release/).check();
    await page.getByRole("button", { name: "Release publiceren en uitrol volgen" }).click();

    await expect(page).toHaveURL(/\/dashboard\/publications\/[0-9a-f-]+/, { timeout: 15_000 });
    await expect(page.getByText("De immutable release is gepubliceerd")).toBeVisible();
    await expect(page.getByText("Huidig gewenst", { exact: true })).toBeVisible();
  });
});
