import { expect, test } from "@playwright/test";

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("media route exposes upload intake labels and status landmarks", async ({
  page
}) => {
  await page.goto("/dashboard/media");

  await expect(page.getByRole("heading", { exact: true, name: "Media" })).toBeVisible();
  await expect(page.getByLabel("Bestand")).toBeVisible();
  await expect(page.getByLabel("Titel")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("echte Supabase sessies");
});

test("playlists route exposes publish review labels and status", async ({
  page
}) => {
  await page.goto("/dashboard/playlists");

  await expect(page.getByRole("heading", { exact: true, name: "Playlists" })).toBeVisible();
  await expect(page.getByLabel("Playlistnaam")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish review" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sponsor slide");
});

test("public auth routes have clear headings and forms", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij Castivo Control" })
  ).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Tenant")).toBeVisible();

  await page.goto("/accept-invite");
  await expect(page.getByRole("heading", { name: "Invite accepteren" })).toBeVisible();
  await expect(page.getByLabel("Invitecode")).toBeVisible();
});
