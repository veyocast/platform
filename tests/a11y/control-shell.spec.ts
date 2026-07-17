import { expect, test } from "@playwright/test";

test("control shell exposes keyboard and landmark basics", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar inhoud" })).toBeFocused();

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Goedemorgen, Daan" })).toBeVisible();
  await expect(page.getByLabel("Open dashboardacties")).toContainText(
    "Publicatie geblokkeerd"
  );
});

test("media route exposes upload intake labels and status landmarks", async ({
  page
}) => {
  await page.goto("/dashboard/media");

  await expect(page.getByRole("heading", { exact: true, name: "Media" })).toBeVisible();
  await expect(page.getByLabel("Bestand")).toBeVisible();
  await expect(page.getByLabel("Titel")).toBeVisible();
  await expect(page.getByLabel("Media pipeline stappen")).toContainText(
    "Player-variant"
  );
  await expect(page.getByRole("status")).toContainText("Uploaden is nog niet beschikbaar");
});

test("playlists route exposes publish review labels and status", async ({
  page
}) => {
  await page.goto("/dashboard/playlists");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(page.getByLabel("Playlistnaam")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicatiereview" })).toBeVisible();
  await expect(page.getByLabel("Playlist publicatietijdlijn")).toContainText(
    "Player bijwerken"
  );
  await expect(page.getByRole("status")).toContainText("Sponsor slide");
});

test("screens route exposes pairing labels and status", async ({ page }) => {
  await page.goto("/dashboard/screens");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByLabel("Schermnaam")).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("CTV 482");
  await expect(page.getByLabel("Player sync diagnostics")).toContainText(
    "Lokale cache"
  );
  await expect(page.getByRole("status")).toContainText("Pairing is in deze demo read-only");
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
