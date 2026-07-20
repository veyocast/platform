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

test("collapsed desktop navigation remains keyboard restorable", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/dashboard");
  await page.evaluate(() => {
    window.localStorage.setItem("veyocast-control-sidebar-collapsed", "true");
  });
  await page.reload();

  const expandButton = page.getByRole("button", {
    name: "Navigatie uitklappen"
  });
  await expect(expandButton).toBeVisible();
  await expandButton.focus();
  await expect(expandButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Navigatie inklappen" })
  ).toBeVisible();
  await expect(
    page.getByLabel("Control navigatie").getByText("Dagelijkse operatie en aandachtspunten")
  ).toBeVisible();
});

test("control shell reflows across canonical viewport widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/dashboard");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);

    if (width < 1024) {
      const menuButton = page.getByRole("button", { name: "Navigatie openen" });
      const quickNavigation = page.getByRole("button", {
        name: "Snel naar een onderdeel"
      });

      for (const control of [menuButton, quickNavigation]) {
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }

      await menuButton.click();
      const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
      await expect(navigation.getByText("Verenigingscontext", { exact: true })).toBeVisible();
      await expect(navigation.getByRole("heading", { name: "Content" })).toBeVisible();
      await expect(navigation.getByRole("link", { name: /Pilotflow/ })).toHaveCount(0);
    } else {
      await expect(page.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeVisible();
    }
  }
});

test("shared audit table becomes labelled mobile rows", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await page.goto("/dashboard/auditlog");

  await expect(
    page.getByRole("table", { name: "Gebeurtenissen binnen de actieve vereniging." })
  ).toBeVisible();
  await expect(page.locator(".vc-data-table td[data-label='Tijd']")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});

test("tenant context selection is explicit and keyboard reachable", async ({ page }) => {
  await page.goto("/dashboard");

  const switcher = page.locator("summary").filter({ hasText: "Museumkwartier" });
  await switcher.focus();
  await expect(switcher).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Werkcontext wisselen" })).toBeVisible();
  await page.getByRole("link", { name: "Alle contexten beheren" }).click();

  await expect(page).toHaveURL(/\/context$/);
  await expect(page.getByRole("heading", { name: "Kies een vereniging" })).toBeVisible();
  await expect(page.getByText("niet automatisch een willekeurige context gekozen")).toBeVisible();
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

test("playlists route exposes searchable resource filters and safe creation", async ({
  page
}) => {
  await page.goto("/dashboard/playlists");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Playlists" })
  ).toBeVisible();
  await expect(page.getByLabel("Playlistnaam")).toBeVisible();
  await expect(page.getByLabel("Zoeken in playlists")).toBeVisible();
  await expect(page.getByRole("combobox", { exact: true, name: "Status" })).toBeVisible();
  await expect(page.getByRole("combobox", { exact: true, name: "Schermgebruik" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlistlijst" })).toBeVisible();
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

test("team route exposes roles and a safely disabled invitation flow", async ({ page }) => {
  await page.goto("/dashboard/team");

  await expect(page.getByRole("heading", { exact: true, level: 1, name: "Team" })).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Uitnodiging versturen" })).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "uitsluitend lokale fixtures" })
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Toegang binnen de actieve vereniging." })).toBeVisible();
});

test("tenant management exposes a labelled and safely disabled creation flow", async ({
  page
}) => {
  await page.goto("/platform/tenants");

  await expect(
    page.getByRole("heading", { exact: true, name: "Tenantbeheer" })
  ).toBeVisible();
  await expect(page.getByLabel("Verenigingsnaam")).toBeVisible();
  await expect(page.getByLabel("Technische slug")).toBeVisible();
  await expect(page.getByLabel("E-mailadres eerste eigenaar")).toBeVisible();
  await expect(page.getByLabel("Schermlimiet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vereniging aanmaken" })
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Aanmaken is hier uitgeschakeld"
  );
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
