import path from "node:path";

import { expect, test } from "@playwright/test";

const livePilotEnabled = process.env.CASTIVO_LIVE_PILOT === "1";
const playerUrl = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test.setTimeout(90_000);

test.describe("live pilot vertical slice", () => {
  test.skip(!livePilotEnabled, "requires local Supabase and explicit live pilot environment");

  test("uploads, publishes, pairs and starts verified playback", async ({
    browser,
    page
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@castivo.test");
    await page.getByLabel("Wachtwoord").fill("castivo-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/media");
    await expect(
      page.getByRole("heading", { exact: true, name: "Media" })
    ).toBeVisible();
    await expect(page.getByText("Live tenantdata")).toBeVisible();

    await page.getByLabel("Videotitel", { exact: true }).fill("Live queuecontrole");
    await page.getByLabel("Videobestand", { exact: true }).setInputFiles({
      buffer: Buffer.from("castivo-invalid-video-fixture"),
      mimeType: "video/mp4",
      name: "queuecontrole.mp4"
    });
    await page.getByRole("button", { name: "Video uploaden" }).click();
    await expect(page.getByText("De video staat veilig in de verwerkingsqueue")).toBeVisible();

    await page.getByLabel("Titel", { exact: true }).fill("Ongeldig logo");
    await page.getByLabel("Bestand", { exact: true }).setInputFiles(
      path.join(process.cwd(), "assets/brand/castivo-logo-primary.svg")
    );
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.locator("p.notice[role='alert']")).toContainText(
      "bestandstype is niet toegestaan"
    );

    await page.getByLabel("Titel", { exact: true }).fill("Live pilotbeeld");
    await page.getByLabel("Bestand", { exact: true }).setInputFiles(
      path.join(
        process.cwd(),
        "apps/control/public/brand/castivo-official-icon.png"
      )
    );
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText("Live pilotbeeld is gecontroleerd")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Live pilotbeeld" })).toBeVisible();

    await page.goto("/dashboard/pilot");
    await expect(page.getByRole("heading", { name: "Pilotflow" })).toBeVisible();
    await expect(page.getByText("Live Supabase")).toBeVisible();

    await page.getByLabel("Playlistnaam").fill("Live pilotplaylist");
    await page.getByLabel("Gereedstaande media").selectOption({ label: "Live pilotbeeld" });
    await page.getByRole("button", { name: "Concept maken" }).click();
    await expect(page.getByText("Conceptplaylist is gemaakt")).toBeVisible();

    await page.getByLabel("Conceptplaylist").selectOption({ label: "Live pilotplaylist" });
    await page.getByLabel("Doelscherm").first().selectOption({ label: "Pilot hoofdscherm" });
    await page.getByRole("button", { name: "Release publiceren" }).click();
    await expect(page.getByText("Immutable release is gemaakt")).toBeVisible();

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto(playerUrl);
    const pairingCode = (
      await playerPage.getByLabel("Pairingcode").textContent()
    )?.trim();

    expect(pairingCode).toMatch(/^[A-Z2-9]{3} [A-Z2-9]{3}$/);

    await page.getByLabel("Koppelcode").fill(pairingCode ?? "");
    await page.getByLabel("Doelscherm").last().selectOption({ label: "Pilot hoofdscherm" });
    await page.getByRole("button", { name: "Player koppelen" }).click();
    await expect(page.getByText("Player is gekoppeld")).toBeVisible();

    await expect(playerPage.getByAltText("Live pilotbeeld")).toBeVisible({
      timeout: 20_000
    });
    await expect(playerPage.getByText("PLAYING", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Live smoke Player")).toHaveCount(0);
    await expect(page.getByText("Chrome pilotplayer")).toBeVisible();
    await expect(page.getByText("Gekoppeld", { exact: true })).toBeVisible();

    await playerContext.close();
  });
});
