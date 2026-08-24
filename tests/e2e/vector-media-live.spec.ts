import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const liveMedia = process.env.VEYOCAST_LIVE_MEDIA_E2E === "1";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.describe("Vector v2 live Media workspace", () => {
  test.skip(!liveMedia, "requires a freshly reset isolated local Supabase stack");
  test.setTimeout(90_000);

  test("uploads, collects and bulk-organizes real tenant media", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/media?view=grid");
    await page.getByRole("link", { name: "Media uploaden" }).click();
    await expect(page).toHaveURL(/upload=1/);
    const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
    await uploadDialog.getByLabel("Afbeeldingen", { exact: true }).setInputFiles([
      { buffer: validPng, mimeType: "image/png", name: "vector-floorplan.png" },
      { buffer: validPng, mimeType: "image/png", name: "vector-sponsor.png" }
    ]);
    await uploadDialog.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(uploadDialog.getByText("2 van 2 gereed")).toBeVisible();
    await uploadDialog.getByRole("button", { name: "Uploadvenster sluiten" }).click();
    await expect(page).not.toHaveURL(/upload=1/);
    await expect.poll(async () => {
      await page.reload();
      return page.getByLabel(/vector (floorplan|sponsor) selecteren/).count();
    }, { timeout: 15_000 }).toBe(2);

    await page.getByRole("button", { name: "Organiseren" }).click();
    const organizationDialog = page.getByRole("dialog", { name: "Mappen en tags" });
    await organizationDialog.getByLabel("Collectienaam").fill("Wedstrijddag");
    await organizationDialog.getByLabel("Omschrijving (optioneel)").fill("Assets voor de ontvangst en sponsorrotatie");
    await organizationDialog.getByRole("button", { name: "Collectie maken" }).click();
    await expect(page.getByText("De mediacollectie is gemaakt.")).toBeVisible();

    await page.getByLabel("vector floorplan selecteren").check();
    await page.getByLabel("vector sponsor selecteren").check();
    const bulkRegion = page.getByRole("form", { name: "Bulkacties voor geselecteerde media" });
    await bulkRegion.getByLabel("Actie").selectOption({ label: "Toevoegen: Wedstrijddag" });
    await bulkRegion.getByRole("button", { name: "Toepassen" }).click();
    await expect(page.getByText("2 media succesvol bijgewerkt.")).toBeVisible();

    await page.getByLabel("Filter media op collectie").selectOption({ label: "Wedstrijddag" });
    await page.getByRole("button", { name: "Filters toepassen" }).click();
    await expect(page.getByText("2 media")).toBeVisible();
    await expect(page.getByText("vector floorplan", { exact: true })).toBeVisible();
    await expect(page.getByText("vector sponsor", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/media/media-collections-1440x900.png" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText("2 media")).toBeVisible();
    const bounds = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/media/media-collections-390x844.png" });
  });
});
