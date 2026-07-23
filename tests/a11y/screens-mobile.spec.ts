import { expect, test } from "@playwright/test";

test("screen onboarding becomes a sequential mobile flow without horizontal overflow", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/screens/new");

  const onboarding = page.getByRole("heading", { name: "Schermdetails en eerste content" });
  const steps = page.getByLabel("Onboardingstappen");
  await expect(onboarding).toBeVisible();
  await expect(steps).toContainText("Player koppelen");

  const [onboardingBox, stepsBox, hasHorizontalOverflow] = await Promise.all([
    onboarding.boundingBox(),
    steps.boundingBox(),
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ]);

  expect(onboardingBox).not.toBeNull();
  expect(stepsBox).not.toBeNull();
  expect(onboardingBox?.y).toBeGreaterThan((stepsBox?.y ?? 0) + (stepsBox?.height ?? 0));
  expect(hasHorizontalOverflow).toBe(false);
});

test("playlist authoring and settings remain sequential on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await page.goto("/dashboard/playlists");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })).toBeVisible();
  await expect(page.getByLabel("Compact playlistoverzicht")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlistlijst" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Instellingencategorieën" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
