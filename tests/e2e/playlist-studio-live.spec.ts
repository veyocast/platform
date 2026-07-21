import { expect, test } from "@playwright/test";

const livePilotEnabled = process.env.VEYOCAST_LIVE_PILOT === "1";
const validPngFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.setTimeout(90_000);

test.describe("live Playlist Studio", () => {
  test.skip(!livePilotEnabled, "requires local Supabase and explicit live pilot environment");

  test("prevents lost updates and completes a multi-screen guided publish", async ({ browser, page }) => {
    const assetTitle = `S25 previewbeeld ${Date.now()}`;
    const secondAssetTitle = `S25 sleepbeeld ${Date.now()}`;
    const secondScreen = `S26 tweede scherm ${Date.now()}`;
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/context/);
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/media");
    await page.getByLabel("Titel", { exact: true }).fill(assetTitle);
    await page.getByLabel("Bestand", { exact: true }).setInputFiles({
      buffer: validPngFixture,
      mimeType: "image/png",
      name: "s25-preview.png"
    });
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText(`${assetTitle} is gecontroleerd`)).toBeVisible();
    await page.getByLabel("Titel", { exact: true }).fill(secondAssetTitle);
    await page.getByLabel("Bestand", { exact: true }).setInputFiles({
      buffer: validPngFixture,
      mimeType: "image/png",
      name: "s25-drag.png"
    });
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText(`${secondAssetTitle} is gecontroleerd`)).toBeVisible();

    await page.goto("/dashboard/playlists");
    await page.getByLabel("Playlistnaam").fill("S25 concurrentieplaylist");
    await page.getByRole("button", { name: "Concept maken" }).click();
    await expect(page.getByText("De conceptplaylist is gemaakt")).toBeVisible();
    await expect(page.getByText("Revisie 0").first()).toBeVisible();

    const staleContext = await browser.newContext({
      storageState: await page.context().storageState()
    });
    const stalePage = await staleContext.newPage();
    await stalePage.goto(page.url());
    await expect(stalePage.getByText("Revisie 0").first()).toBeVisible();

    await page
      .getByRole("listitem")
      .filter({ hasText: assetTitle })
      .getByRole("button", { name: "Toevoegen" })
      .click();
    await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
    await expect(page.getByText("Revisie 1").first()).toBeVisible();

    await stalePage.getByLabel("Playlistnaam").fill("Stale naam mag niet winnen");
    await stalePage.getByRole("button", { name: "Conceptgegevens opslaan" }).click();
    await expect(stalePage.getByText("Dit concept is ondertussen gewijzigd.")).toBeVisible();
    await expect(stalePage.getByText("Jouw actie is niet uitgevoerd.")).toBeVisible();
    await stalePage.getByText("Revisies vergelijken", { exact: true }).click();
    await expect(stalePage.getByText("Nieuwste revisie", { exact: true })).toBeVisible();
    await staleContext.close();

    await expect(page.getByAltText(`Voorbeeld van ${assetTitle}`)).toBeVisible();
    await page.getByRole("button", { name: `${assetTitle} bewerken` }).click();
    await expect(page.getByLabel("Afspeelduur in seconden")).toHaveValue("10");
    await expect(page.getByLabel("Weergave")).toHaveValue("contain");

    await page.getByLabel("Afspeelduur in seconden").fill("14");
    await page.getByRole("button", { name: "Venster sluiten" }).click();
    let leaveWarning = "";
    page.once("dialog", async (dialog) => {
      leaveWarning = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("link", { name: "Terug naar playlists" }).click();
    expect(leaveWarning).toContain("niet-opgeslagen formulierwijzigingen");
    await page.getByRole("button", { name: `${assetTitle} bewerken` }).click();
    await page.getByLabel("Afspeelduur in seconden").fill("14");
    await page.getByRole("button", { name: "Wijzigingen opslaan" }).click();
    await expect(page.getByText("De iteminstellingen zijn opgeslagen")).toBeVisible();

    await page
      .getByRole("listitem")
      .filter({ hasText: secondAssetTitle })
      .getByRole("button", { name: "Toevoegen" })
      .click();
    await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
    const dragHandle = page.getByRole("button", { name: new RegExp(`Versleep ${secondAssetTitle}`) });
    await dragHandle.scrollIntoViewIfNeeded();
    const sourceBox = await dragHandle.boundingBox();
    const targetBox = await page.locator(".playlist-item-list > li").first().boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Drag-and-drop-posities zijn niet beschikbaar.");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 - 8, { steps: 2 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText("De nieuwe volgorde is opgeslagen")).toBeVisible();
    await expect(page.locator(".playlist-item-list > li").first()).toContainText(secondAssetTitle);

    const studioUrl = page.url();
    await page.goto("/dashboard/screens/new");
    await page.getByLabel("Schermnaam").fill(secondScreen);
    await page.getByLabel("Locatie").fill("Bestuurskamer");
    await page.getByRole("button", { name: "Scherm maken en doorgaan" }).click();
    await expect(page.getByText("Schermdetails zijn opgeslagen")).toBeVisible();

    await page.goto(studioUrl);
    await page.getByRole("link", { name: "Begeleide publicatie starten" }).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/.+\/publish$/);
    await page.getByLabel(/Pilot hoofdscherm/).check();
    await page.getByLabel(new RegExp(secondScreen)).check();
    await page.getByRole("button", { name: "Preflight voor selectie berekenen" }).click();
    await expect(page.getByRole("heading", { name: "4. Preflight per scherm" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Onbekend" })).toHaveCount(2);
    await page.getByLabel("Releasenotitie").fill("S26 multi-screen publicatie");
    await page.getByLabel(/waarschuwingen en onbekende telemetry/i).check();
    await page.getByLabel("Maak een nieuwe immutable release").check();
    await page.getByRole("button", { name: "Release publiceren en uitrol volgen" }).click();
    await expect(page).toHaveURL(/\/dashboard\/releases\/[0-9a-f-]+/);
    await expect(page.getByText("De immutable release is gepubliceerd")).toBeVisible();
    await expect(page.getByText("Huidig gewenst", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Impactketen" })).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Uitrol per scherm" })).toBeVisible();
    const horizontalLayout = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(horizontalLayout.scrollWidth <= horizontalLayout.innerWidth).toBe(true);
  });
});
