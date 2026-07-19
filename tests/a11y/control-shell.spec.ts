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
  await expect(page.getByLabel("Bestand", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Titel", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Videobestand", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Videotitel", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Media pipeline stappen")).toContainText(
    "Veilig activeren"
  );
  await expect(page.getByRole("status").filter({
    hasText: "Uploaden is niet beschikbaar in de demomodus"
  })).toBeVisible();
  await expect(page.getByRole("button", { name: "Uploaden en verifiëren" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Video uploaden" })).toBeDisabled();
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
  await expect(page.getByRole("status").filter({ hasText: "Configureer Supabase" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concept maken" })).toBeDisabled();
});

test("settings route exposes real defaults with safe permission state", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Instellingen" })).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Afbeeldingsduur in seconden")).toBeVisible();
  await expect(page.getByLabel("Video standaard zonder geluid")).toBeVisible();
  await expect(page.getByLabel("Oriëntatie")).toBeVisible();
  await expect(page.getByRole("button", { name: "Instellingen opslaan" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Configureer Supabase");
});

test("screens route exposes pairing labels and status", async ({ page }) => {
  await page.goto("/dashboard/screens");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Schermen" })
  ).toBeVisible();
  await expect(page.getByLabel("Schermnaam")).toBeVisible();
  await expect(page.getByLabel("Koppelcode")).toBeVisible();
  await expect(page.getByLabel("Doelscherm")).toBeVisible();
  await expect(page.getByLabel("Pairingcontroles")).toContainText("Server-side");
  await expect(page.getByLabel("Device lifecycle stappen")).toContainText(
    "Last-known-good"
  );
  await expect(page.getByRole("status").filter({ hasText: "geen fictieve schermen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scherm opslaan" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Player veilig koppelen" })).toBeDisabled();
});

test("pilot route exposes a sequential and fully labelled flow", async ({ page }) => {
  await page.goto("/dashboard/pilot");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Pilotflow" })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Pilotstappen" })).toBeVisible();
  await expect(page.getByLabel("Afbeelding")).toBeVisible();
  await expect(page.getByLabel("Gereedstaande media")).toBeVisible();
  await expect(page.getByLabel("Conceptplaylist")).toBeVisible();
  await expect(page.getByLabel("Koppelcode")).toBeVisible();
  await expect(page.getByText("Demomodus", { exact: true })).toBeVisible();
});

test("public auth routes have clear headings and forms", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Inloggen bij VeyoCast Control" })
  ).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByLabel("Tenant")).toBeVisible();

  await page.goto("/accept-invite");
  await expect(page.getByRole("heading", { name: "Uitnodiging afronden" })).toBeVisible();
  await expect(page.getByText("geen geldige uitnodigingssessie")).toBeVisible();
  await expect(page.getByLabel("Nieuw wachtwoord")).toHaveCount(0);
});
