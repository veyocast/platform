import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

const livePilotEnabled = process.env.VEYOCAST_LIVE_PILOT === "1";
const playerUrl = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const videoFixture = process.env.VEYOCAST_VIDEO_FIXTURE;
const workerImage = process.env.VEYOCAST_MEDIA_WORKER_IMAGE ?? "veyocast-media-worker:replace-with-full-git-sha";
const validPngFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.setTimeout(240_000);

test.describe("live pilot vertical slice", () => {
  test.skip(!livePilotEnabled, "requires local Supabase and explicit live pilot environment");

  test("uploads, publishes, pairs and starts verified playback", async ({
    browser,
    page
  }) => {
    const invitedOwnerEmail = `live-owner-${Date.now()}@veyocast.test`;
    const invitedPlatformEmail = `live-platform-${Date.now()}@veyocast.test`;

    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/context/);
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/auth/mfa");
    await page.getByLabel("Naam van authenticator").fill("Playwright live pilot");
    await page.getByRole("button", { name: "Nieuwe authenticator toevoegen" }).click();
    const manualSecret = page.getByText("Handmatige sleutel tonen");
    await expect(manualSecret).toBeVisible();
    await manualSecret.click();
    const mfaSecret = (await page.locator(".mfa-secret").textContent())?.trim();
    expect(mfaSecret).toBeTruthy();
    await page.getByLabel("Zescijferige code").fill(generateTotp(mfaSecret ?? ""));
    await page.getByRole("button", { name: "Authenticator verifiëren" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/platform/users");
    await page.getByLabel("E-mailadres").fill(invitedPlatformEmail);
    await page.getByLabel("Platformrol").selectOption("platform_viewer");
    await page.getByRole("button", { name: "Platformrol instellen" }).click();
    await expect(page.getByText("Het platformaccount is uitgenodigd en de rol is veilig toegewezen.")).toBeVisible();
    await expect(page.getByRole("cell", { name: new RegExp(invitedPlatformEmail) })).toBeVisible();

    const platformInvitationLink = await waitForInvitationLink(invitedPlatformEmail);
    const invitedPlatformContext = await browser.newContext();
    const invitedPlatformPage = await invitedPlatformContext.newPage();
    await invitedPlatformPage.goto(platformInvitationLink);
    await expect(invitedPlatformPage).toHaveURL(/\/accept-invite\?type=account$/);
    await expect(invitedPlatformPage.getByText("persoonlijk VeyoCast-platformaccount")).toBeVisible();
    await invitedPlatformPage.getByLabel("Naam").fill("Live platformkijker");
    await invitedPlatformPage.getByLabel("Nieuw wachtwoord").fill("veyocast-live-platform-2026");
    await invitedPlatformPage.getByLabel("Herhaal wachtwoord").fill("veyocast-live-platform-2026");
    await invitedPlatformPage.getByRole("button", { name: "Account instellen" }).click();
    await expect(invitedPlatformPage).toHaveURL(/\/login\?reden=uitgenodigd/);
    await invitedPlatformPage.getByLabel("E-mailadres").fill(invitedPlatformEmail);
    await invitedPlatformPage.getByLabel("Wachtwoord").fill("veyocast-live-platform-2026");
    await invitedPlatformPage.getByRole("button", { name: "Doorgaan" }).click();
    await expect(invitedPlatformPage).toHaveURL(/\/platform$/);
    await invitedPlatformContext.close();

    await page.goto("/platform/tenants");
    await page.getByLabel("Verenigingsnaam").fill("Live aangemaakte vereniging");
    await page.getByLabel("Technische slug").fill("live-aangemaakte-vereniging");
    await page.getByLabel("E-mailadres eerste eigenaar").fill(invitedOwnerEmail);
    await page.getByLabel("Schermlimiet").fill("8");
    await page.getByRole("button", { name: "Vereniging aanmaken" }).click();
    await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]+\?succes=aangemaakt/);
    await expect(page.getByRole("heading", { name: "Live aangemaakte vereniging" })).toBeVisible();
    await expect(page.getByText("De vereniging en eigenaaruitnodiging zijn veilig aangemaakt.")).toBeVisible();
    await expect(page.getByRole("cell", { name: invitedOwnerEmail })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Verstuurd" })).toBeVisible();

    const invitationLink = await waitForInvitationLink(invitedOwnerEmail);
    const invitedOwnerContext = await browser.newContext();
    const invitedOwnerPage = await invitedOwnerContext.newPage();
    await invitedOwnerPage.goto(invitationLink);
    await expect(invitedOwnerPage).toHaveURL(/\/accept-invite$/);
    await expect(invitedOwnerPage.getByText("Live aangemaakte vereniging")).toBeVisible();
    await invitedOwnerPage.getByLabel("Naam").fill("Live eigenaar");
    await invitedOwnerPage.getByLabel("Nieuw wachtwoord").fill("veyocast-live-owner-2026");
    await invitedOwnerPage.getByLabel("Herhaal wachtwoord").fill("veyocast-live-owner-2026");
    await invitedOwnerPage.getByRole("button", { name: "Account instellen" }).click();
    await expect(invitedOwnerPage).toHaveURL(/\/login\?reden=uitgenodigd/);
    await invitedOwnerPage.getByLabel("E-mailadres").fill(invitedOwnerEmail);
    await invitedOwnerPage.getByLabel("Wachtwoord").fill("veyocast-live-owner-2026");
    await invitedOwnerPage.getByRole("button", { name: "Doorgaan" }).click();
    await expect(invitedOwnerPage).toHaveURL(/\/context/);
    await expect(
      invitedOwnerPage.getByLabel("Jouw toegang").getByText("Live aangemaakte vereniging")
    ).toBeVisible();
    await invitedOwnerContext.close();

    await page.goto("/dashboard/screens/new");
    await page.getByLabel("Schermnaam").fill("LG sprint scherm");
    await page.getByLabel("Locatie").fill("Fysieke testruimte");
    await page.getByRole("button", { name: "Scherm maken en doorgaan" }).click();
    await expect(page.getByText("Schermdetails zijn opgeslagen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Player koppelen en eerste heartbeat" })).toBeVisible();
    const screenOnboardingUrl = page.url();

    await page.goto("/dashboard/media");
    await expect(
      page.getByRole("heading", { exact: true, name: "Media" })
    ).toBeVisible();

    await page.goto("/dashboard/media?upload=1");
    const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
    await uploadDialog.getByRole("tab", { name: "Video" }).click();
    await page.getByLabel("Videotitel", { exact: true }).fill("Live queuecontrole");
    await page.getByLabel("Videobestand", { exact: true }).setInputFiles(videoFixture ?? {
      buffer: Buffer.from("veyocast-invalid-video-fixture"),
      mimeType: "video/mp4",
      name: "queuecontrole.mp4"
    });
    await page.getByRole("button", { name: "Video uploaden" }).click();
    await expect(
      page.getByText("De video staat veilig in de verwerkingsqueue")
    ).toBeVisible({ timeout: 30_000 });
    await uploadDialog.getByRole("button", { name: "Uploadvenster sluiten" }).click();

    if (videoFixture) {
      execFileSync("docker", [
        "run", "--rm", "--network", "host",
        "-e", `SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
        "-e", "SUPABASE_SERVICE_ROLE_KEY",
        "-e", "MEDIA_WORKER_ID=live-pilot-ffmpeg",
        workerImage,
        "pnpm", "--filter", "@veyocast/media-worker", "worker:once"
      ], { env: process.env, stdio: "pipe" });
      await page.reload();
      const videoRow = page.getByRole("row", { name: /Live queuecontrole/ });
      await expect(videoRow).toContainText("Gereed");
    }

    await page.goto("/dashboard/media?upload=1");
    await page.getByLabel("Titel voor één afbeelding", { exact: true }).fill("Ongeldig logo");
    await page.getByLabel("Afbeeldingen", { exact: true }).setInputFiles(
      path.join(process.cwd(), "assets/brand/veyocast-logo-primary.svg")
    );
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(
      page.getByRole("region", { name: "Resultaat van afbeeldinguploads" })
    ).toContainText("De bestandsinhoud komt niet overeen met het opgegeven type");

    await page.goto("/dashboard/media?upload=1");
    await page.getByLabel("Titel voor één afbeelding", { exact: true }).fill("Live pilotbeeld");
    await page.getByLabel("Afbeeldingen", { exact: true }).setInputFiles({
      buffer: validPngFixture,
      mimeType: "image/png",
      name: "veyocast-live-pilot.png"
    });
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText("Live pilotbeeld is gecontroleerd")).toBeVisible();
    await page.getByRole("button", { name: "Uploadvenster sluiten" }).click();
    await expect.poll(async () => {
      await page.reload();
      return page.getByText("Live pilotbeeld", { exact: true }).count();
    }, { intervals: [1_000, 2_000], timeout: 15_000 }).toBeGreaterThan(0);

    await page.goto("/dashboard/settings");
    await page.getByLabel("Verenigingsnaam").fill("VeyoCast live pilot");
    await page.getByRole("button", { name: "Afspelen", exact: true }).click();
    await page.getByLabel("Afbeeldingsduur in seconden").fill("12");
    await page.getByLabel("Standaard weergave").selectOption("cover");
    await page.getByRole("button", { name: "Instellingen opslaan" }).click({ timeout: 10_000 });
    await expect(page.getByText("zijn opgeslagen")).toBeVisible();

    await page.goto("/dashboard/playlists");
    await page.getByRole("button", { name: "Nieuwe playlist" }).click();
    const createPlaylistDialog = page.getByRole("dialog", { name: "Nieuwe playlist" });
    await createPlaylistDialog.getByLabel("Playlistnaam").fill("Live pilotplaylist");
    await createPlaylistDialog.getByRole("button", { name: "Concept maken" }).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/[0-9a-f-]{36}/i, {
      timeout: 15_000
    });
    await expect(page.getByText("De conceptplaylist is gemaakt")).toBeVisible();

    const staleEditorContext = await browser.newContext({
      storageState: await page.context().storageState()
    });
    const staleEditorPage = await staleEditorContext.newPage();
    await staleEditorPage.goto(page.url());
    await expect(staleEditorPage.getByText("Revisie 0").first()).toBeVisible();

    await page
      .getByRole("list", { name: "Gereedstaande inhoud" })
      .getByRole("listitem")
      .filter({ hasText: "Live pilotbeeld" })
      .getByRole("button", { name: "Toevoegen: Live pilotbeeld" })
      .click();
    await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
    await staleEditorPage.getByLabel("Playlistnaam").fill("Stale browsernaam");
    await staleEditorPage.getByRole("button", { name: "Naam en beschrijving opslaan" }).click();
    await expect(staleEditorPage.getByText("Dit concept is ondertussen gewijzigd.")).toBeVisible();
    await expect(staleEditorPage.getByText("Jouw actie is niet uitgevoerd.")).toBeVisible();
    await expect(staleEditorPage.getByRole("link", { name: "Nieuwste versie laden" })).toBeVisible();
    await staleEditorContext.close();
    await page.getByRole("button", { name: "Live pilotbeeld bewerken" }).click();
    await expect(page.getByLabel("Afspeelduur in seconden")).toHaveValue("12");
    await expect(page.getByLabel("Weergave")).toHaveValue("cover");

    await page.getByLabel("Afspeelduur in seconden").fill(videoFixture ? "5" : "14");
    await page.getByLabel("Weergave").selectOption("contain");
    let leaveWarning = "";
    page.once("dialog", async (dialog) => {
      leaveWarning = dialog.message();
      await dialog.dismiss();
    });
    await page
      .locator("#control-content")
      .getByRole("link", { name: "Playlists", exact: true })
      .click();
    expect(leaveWarning).toContain("niet-opgeslagen wijzigingen");
    await expect(page).toHaveURL(/\/dashboard\/playlists\/[0-9a-f-]{36}/i);
    await page.getByRole("button", { name: "Live pilotbeeld bewerken" }).click();
    await page.getByLabel("Afspeelduur in seconden").fill(videoFixture ? "5" : "14");
    await page.getByLabel("Weergave").selectOption("contain");
    await page.getByRole("button", { name: "Item opslaan" }).click();
    const itemSaved = page.getByText("De iteminstellingen zijn opgeslagen");
    try {
      await expect(itemSaved).toBeVisible({ timeout: 10_000 });
    } catch {
      const retry = page.getByRole("button", { name: "Opnieuw proberen" });
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(page.getByRole("button", { name: "Live pilotbeeld bewerken" })).toBeVisible();
      await page.getByRole("button", { name: "Live pilotbeeld bewerken" }).click();
      await page.getByLabel("Afspeelduur in seconden").fill(videoFixture ? "5" : "14");
      await page.getByLabel("Weergave").selectOption("contain");
      await page.getByRole("button", { name: "Item opslaan" }).click();
      await expect(itemSaved).toBeVisible({ timeout: 20_000 });
    }

    if (videoFixture) {
      await page
        .getByRole("list", { name: "Gereedstaande inhoud" })
        .getByRole("listitem")
        .filter({ hasText: "Live queuecontrole" })
        .getByRole("button", { name: "Toevoegen: Live queuecontrole" })
        .click();
      await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
      const dragHandle = page.getByRole("button", { name: /Versleep Live queuecontrole/ });
      await dragHandle.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Space");
      await expect(page.getByText("De nieuwe volgorde is opgeslagen")).toBeVisible();
      await page.getByRole("button", { name: "Voorbeeld" }).click();
      await page
        .getByRole("button", { name: "Volgend playlistitem" })
        .click();
      const previewVideo = page.getByLabel("Voorbeeldvideo Live queuecontrole");
      await expect(previewVideo).toBeVisible();
      await expect(previewVideo).toHaveJSProperty("muted", true);
    }

    await page.getByRole("link", { name: "Publiceren" }).click();
    await expect(page).toHaveURL(/\/dashboard\/playlists\/.+\/publish$/);
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await page.getByLabel(/LG sprint scherm/).check();
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await page.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" }).click();
    await page.getByLabel(/waarschuwingen en onbekende telemetry/i).check();
    await page.getByLabel(/Maak één nieuwe immutable release/).check();
    await page.getByRole("button", { name: "Release publiceren en uitrol volgen" }).click();
    await expect(page.getByText("De immutable release is gepubliceerd")).toBeVisible();

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    const firstHeartbeat = playerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/player/heartbeat") && response.status() === 200,
      { timeout: 20_000 }
    );
    await playerPage.goto(playerUrl);
    const pairingCode = (
      await playerPage.getByLabel("Pairingcode").textContent()
    )?.trim();

    expect(pairingCode).toMatch(/^[A-Z2-9]{3} [A-Z2-9]{3}$/);

    await page.goto(screenOnboardingUrl);
    await expect(page.getByRole("heading", { name: "Player koppelen en eerste heartbeat" })).toBeVisible();
    await page.getByLabel("Koppelcode").fill(pairingCode ?? "");
    await page.getByRole("button", { name: "Player veilig koppelen" }).click();
    await expect(page.getByText("De Player is gekoppeld")).toBeVisible();

    await expect(playerPage.getByAltText("Live pilotbeeld")).toBeVisible({
      timeout: 20_000
    });
    await expect(playerPage.getByRole("region", { name: "Release playback" })).toBeVisible();
    await expect(playerPage.getByText("PLAYING", { exact: true })).toBeHidden();
    await firstHeartbeat;
    if (videoFixture) {
      const playingVideo = playerPage.locator("video");
      await expect(playingVideo).toBeVisible({ timeout: 20_000 });
      await expect(playingVideo).toHaveJSProperty("muted", true);
    }

    await page.goto("/dashboard/screens");
    await expect(page.getByRole("cell", { name: "LG webOS Signage" })).toBeVisible();
    const screenRow = page.getByRole("row").filter({ hasText: "LG sprint scherm" });
    await expect.poll(async () => {
      await page.reload();
      return screenRow.textContent();
    }, { intervals: [5_000], timeout: 45_000 }).toContain("Online");
    const screenDetailHref = await screenRow
      .getByRole("link", { name: "Bekijk scherm" })
      .getAttribute("href");
    expect(screenDetailHref).toMatch(/^\/dashboard\/screens\/[0-9a-f-]{36}$/i);
    await page.goto(screenDetailHref ?? "/dashboard/screens");
    await expect(page.getByRole("heading", { exact: true, level: 1, name: "LG sprint scherm" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Schermdetails" })).toContainText("Activiteit");
    await page.getByRole("link", { name: "Gezondheid", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "Actieve Player" })).toBeVisible();
    await expect(page.getByText("LG webOS Signage", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Actieve release", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Synchronisatietijdlijn" })).toBeVisible();
    await page.getByRole("link", { name: "Activiteit", exact: true }).press("Enter");
    await expect(page.getByText("Player gekoppeld", { exact: true })).toBeVisible();

    await playerContext.close();
  });
});

function generateTotp(secret: string, now = Date.now()) {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)
  ) >>> 0;
  return String(binary % 1_000_000).padStart(6, "0");
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=|\s/g, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 MFA secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? [];
  return Buffer.from(bytes);
}

async function waitForInvitationLink(email: string) {
  const mailpitUrl = process.env.MAILPIT_URL;
  if (!mailpitUrl) throw new Error("MAILPIT_URL is required for the live invitation flow");

  let invitationLink: string | null = null;
  await expect.poll(async () => {
    invitationLink = await findInvitationLink(mailpitUrl, email);
    return invitationLink;
  }, { timeout: 10_000 }).not.toBeNull();

  if (!invitationLink) throw new Error(`No invitation link found for ${email}`);
  return invitationLink;
}

async function findInvitationLink(mailpitUrl: string, email: string) {
  const messagesResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!messagesResponse.ok) return null;
  const inbox = await messagesResponse.json() as {
    messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
  };
  const message = inbox.messages?.find((item) =>
    item.To?.some((recipient) => recipient.Address?.toLowerCase() === email.toLowerCase())
  );
  if (!message) return null;

  const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`);
  if (!messageResponse.ok) return null;
  const body = await messageResponse.json() as { Text?: string };
  const rawLink = body.Text?.match(/https?:\/\/[^\s)]+/)?.[0];
  if (!rawLink) return null;

  const invitationUrl = new URL(rawLink.replaceAll("&amp;", "&"));
  if (invitationUrl.pathname !== "/auth/v1/verify") return invitationUrl.toString();

  const redirectTo = invitationUrl.searchParams.get("redirect_to");
  const tokenHash = invitationUrl.searchParams.get("token");
  const type = invitationUrl.searchParams.get("type");
  if (!redirectTo || !tokenHash || type !== "invite") return null;

  const appInvitationUrl = new URL(redirectTo);
  appInvitationUrl.searchParams.set("token_hash", tokenHash);
  appInvitationUrl.searchParams.set("type", type);
  return appInvitationUrl.toString();
}
