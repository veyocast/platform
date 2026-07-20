import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player starts in unpaired pairing mode", async ({ page }) => {
  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(playerURL);

  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("VYO 482");
  await expect(page.getByLabel("Device setupstatus")).toContainText("Wachten op VeyoCast Control");
  const logo = page.getByRole("img", { name: "VeyoCast" });
  await expect(logo).toBeVisible();
  const logoBox = await logo.boundingBox();
  expect(logoBox?.height).toBeGreaterThanOrEqual(64);
  await expect(page.locator(".pairing-brand-scene img")).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toContainText("Web Player");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Code geldig");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Geen Supabase Auth-user");
});

test("player pairing becomes static when reduced motion is requested", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(playerURL);

  const brandIcon = page.locator(".pairing-brand-scene img");
  await expect(brandIcon).toBeVisible();
  await expect(brandIcon).toHaveCSS("animation-name", "none");
  await expect(page.locator(".pairing-brand-accent--orange")).toHaveCSS(
    "animation-name",
    "none"
  );
});
