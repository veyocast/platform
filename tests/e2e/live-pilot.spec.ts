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

test.setTimeout(90_000);

test.describe("live pilot vertical slice", () => {
  test.skip(!livePilotEnabled, "requires local Supabase and explicit live pilot environment");

  test("uploads, publishes, pairs and starts verified playback", async ({
    browser,
    page
  }) => {
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

    await page.goto("/platform/tenants");
    await page.getByLabel("Verenigingsnaam").fill("Live aangemaakte vereniging");
    await page.getByLabel("Technische slug").fill("live-aangemaakte-vereniging");
    await page.getByLabel("Schermlimiet").fill("8");
    await page.getByRole("button", { name: "Vereniging aanmaken" }).click();
    await expect(
      page.getByText("standaardinstellingen en jouw tenant-eigenaarschap")
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Live aangemaakte vereniging" })
    ).toBeVisible();

    await page.goto("/dashboard/screens");
    await page.getByLabel("Schermnaam").fill("LG sprint scherm");
    await page.getByLabel("Locatie").fill("Fysieke testruimte");
    await page.getByRole("button", { name: "Scherm opslaan" }).click();
    await expect(page.getByText("Het scherm is aangemaakt")).toBeVisible();
    await expect(page.getByRole("cell", { name: "LG sprint scherm" })).toBeVisible();

    await page.goto("/dashboard/media");
    await expect(
      page.getByRole("heading", { exact: true, name: "Media" })
    ).toBeVisible();
    await expect(page.getByText("Live tenantdata")).toBeVisible();

    await page.getByLabel("Videotitel", { exact: true }).fill("Live queuecontrole");
    await page.getByLabel("Videobestand", { exact: true }).setInputFiles(videoFixture ?? {
      buffer: Buffer.from("veyocast-invalid-video-fixture"),
      mimeType: "video/mp4",
      name: "queuecontrole.mp4"
    });
    await page.getByRole("button", { name: "Video uploaden" }).click();
    await expect(page.getByText("De video staat veilig in de verwerkingsqueue")).toBeVisible();

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

    await page.getByLabel("Titel", { exact: true }).fill("Ongeldig logo");
    await page.getByLabel("Bestand", { exact: true }).setInputFiles(
      path.join(process.cwd(), "assets/brand/veyocast-logo-primary.svg")
    );
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.locator("p.notice[role='alert']")).toContainText(
      "bestandstype is niet toegestaan"
    );

    await page.getByLabel("Titel", { exact: true }).fill("Live pilotbeeld");
    await page.getByLabel("Bestand", { exact: true }).setInputFiles({
      buffer: validPngFixture,
      mimeType: "image/png",
      name: "veyocast-live-pilot.png"
    });
    await page.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(page.getByText("Live pilotbeeld is gecontroleerd")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Live pilotbeeld" })).toBeVisible();

    await page.goto("/dashboard/settings");
    await page.getByLabel("Verenigingsnaam").fill("VeyoCast live pilot");
    await page.getByLabel("Afbeeldingsduur in seconden").fill("12");
    await page.getByLabel("Standaard weergave").selectOption("cover");
    await page.getByRole("button", { name: "Instellingen opslaan" }).click();
    await expect(page.getByText("zijn opgeslagen")).toBeVisible();

    await page.goto("/dashboard/playlists");
    await expect(page.getByText("Live tenantdata")).toBeVisible();
    await page.getByLabel("Playlistnaam").first().fill("Live pilotplaylist");
    await page.getByRole("button", { name: "Concept maken" }).click();
    await expect(page.getByText("De conceptplaylist is gemaakt")).toBeVisible();

    await page.getByLabel("Gereedstaande media").selectOption({ label: "Live pilotbeeld · Afbeelding" });
    await page.getByRole("button", { name: "Aan playlist toevoegen" }).click();
    await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
    await expect(page.getByLabel("Duur in seconden")).toHaveValue("12");
    await expect(page.getByLabel("Weergave")).toHaveValue("cover");

    await page.getByLabel("Duur in seconden").fill(videoFixture ? "5" : "14");
    await page.getByLabel("Weergave").selectOption("contain");
    await page.getByRole("button", { name: "Iteminstellingen opslaan" }).click();
    await expect(page.getByText("De iteminstellingen zijn opgeslagen")).toBeVisible();

    if (videoFixture) {
      await page.getByLabel("Gereedstaande media").selectOption({ label: "Live queuecontrole · Video" });
      await page.getByRole("button", { name: "Aan playlist toevoegen" }).click();
      await expect(page.getByText("Het media-item is aan het concept toegevoegd")).toBeVisible();
      await page.getByRole("button", { name: "Volgende" }).click();
      const previewVideo = page.getByLabel("Voorbeeldvideo Live queuecontrole");
      await expect(previewVideo).toBeVisible();
      await expect(previewVideo).toHaveJSProperty("muted", true);
    }

    await page.getByLabel("LG sprint scherm").check();
    await page.getByRole("button", { name: "Release publiceren" }).click();
    await expect(page.getByText("De immutable release is gemaakt")).toBeVisible();

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

    await page.goto("/dashboard/screens");
    await expect(page.getByText("Live tenantdata")).toBeVisible();
    await page.getByLabel("Doelscherm").selectOption({ label: "LG sprint scherm" });
    await page.getByLabel("Koppelcode").fill(pairingCode ?? "");
    await page.getByRole("button", { name: "Player veilig koppelen" }).click();
    await expect(page.getByText("De Player is gekoppeld")).toBeVisible();

    await expect(playerPage.getByAltText("Live pilotbeeld")).toBeVisible({
      timeout: 20_000
    });
    await expect(playerPage.getByText("PLAYING", { exact: true })).toBeVisible();
    await firstHeartbeat;
    if (videoFixture) {
      const playingVideo = playerPage.locator("video");
      await expect(playingVideo).toBeVisible({ timeout: 20_000 });
      await expect(playingVideo).toHaveJSProperty("muted", true);
    }

    await page.reload();
    await expect(page.getByRole("cell", { name: "LG webOS Signage" })).toBeVisible();
    await expect(page.getByLabel("Schermvloot").getByText("Online", { exact: true })).toBeVisible();

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
