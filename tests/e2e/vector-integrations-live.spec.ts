import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const liveIntegrations = process.env.VEYOCAST_LIVE_INTEGRATIONS_E2E === "1";
const publicId = "50000000-0000-4000-8000-000000001251";

test.describe("Vector v2 Engage and integration boundaries", () => {
  test.skip(!liveIntegrations, "requires the isolated local Engage fixture");

  test("votes mobile-first and exposes results only after voting", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/engage/${publicId}`);
    await expect(page.getByRole("heading", { name: "Man van de wedstrijd" })).toBeVisible();
    await expect(page.getByText(/% ·/)).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/integrations/engage-vote-390x844.png", fullPage: true });
    await page.getByRole("button", { name: "Ruben de Vries" }).click();
    await expect(page.getByText("Je stem telt mee. Dank je wel!")).toBeVisible();
    await expect(page.getByText(/% ·/).first()).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/vector-v2/integrations/engage-result-390x844.png", fullPage: true });
  });

  test("shows tenant authoring, QR and honest integration rollout", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.goto("/dashboard/engage");
    await expect(page.getByRole("heading", { name: "Engage" })).toBeVisible();
    await expect(page.getByAltText("QR-code voor Man van de wedstrijd")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/integrations/engage-control-1440x900.png", fullPage: true });

    await page.goto("/dashboard/integrations");
    await expect(page.getByRole("heading", { name: "Officiële online playback" })).toBeVisible();
    await expect(page.getByText("Gecontroleerde pilot", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/vector-v2/integrations/catalog-1440x900.png", fullPage: true });
  });
});
