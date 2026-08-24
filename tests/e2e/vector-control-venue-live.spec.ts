import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const liveVenue = process.env.VEYOCAST_LIVE_VENUE_E2E === "1";
const tenantId = "10000000-0000-4000-8000-000000000101";
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.describe("Vector v2 live Control, Health and Venue Twin", () => {
  test.skip(!liveVenue, "requires a freshly reset isolated local Supabase stack");
  test.setTimeout(90_000);

  test("rolls out, configures and reads one real venue graph", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });

    await page.goto(`/auth/mfa?terug=${encodeURIComponent(`/platform/tenants/${tenantId}`)}`);
    await page.getByLabel("Naam van authenticator").fill("Vector Venue E2E");
    await page.getByRole("button", { name: "Nieuwe authenticator toevoegen" }).click();
    await page.getByText("Handmatige sleutel tonen").click();
    const secret = (await page.locator(".mfa-secret").textContent())?.trim();
    expect(secret).toBeTruthy();
    await page.getByLabel("Zescijferige code").fill(generateTotp(secret ?? ""));
    await page.getByRole("button", { name: "Authenticator verifiëren" }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${tenantId}`));

    const venueCard = page.getByRole("heading", { name: "Venue Twin" }).locator("xpath=ancestor::section[1]");
    await venueCard.getByLabel("Reden voor vrijgeven").fill("Geïsoleerde Vector Venue end-to-end verificatie");
    await venueCard.getByRole("button", { name: "Tenant vrijgeven" }).click();
    await expect.poll(async () => {
      await page.reload();
      return venueCard.getByRole("button", { name: "Kill switch activeren" }).count();
    }, { intervals: [1_000], timeout: 30_000 }).toBe(1);
    const healthCard = page.getByRole("heading", { name: "Screen Health" }).locator("xpath=ancestor::section[1]");
    await healthCard.getByLabel("Reden voor vrijgeven").fill("Geïsoleerde Screen Health end-to-end verificatie");
    await healthCard.getByRole("button", { name: "Tenant vrijgeven" }).click();
    await expect.poll(async () => {
      await page.reload();
      return healthCard.getByRole("button", { name: "Kill switch activeren" }).count();
    }, { intervals: [1_000], timeout: 30_000 }).toBe(1);
    await page.getByRole("heading", { name: "Gecontroleerde productuitrol" }).evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await page.screenshot({ path: "docs/screenshots/vector-v2/control/platform-rollout-1440x900.png" });

    await page.getByRole("button", { name: "Open vereniging" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Overzicht" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Integraties\s/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/control/system-pulse-1440x900.png" });

    await page.goto("/dashboard/media");
    await page.getByRole("link", { name: "Media uploaden" }).click();
    await expect(page).toHaveURL(/upload=1/);
    const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
    await uploadDialog.getByLabel("Titel voor één afbeelding", { exact: true }).fill("Venue plattegrond");
    await uploadDialog.getByLabel("Afbeeldingen", { exact: true }).setInputFiles({
      buffer: validPng,
      mimeType: "image/png",
      name: "venue-plattegrond.png"
    });
    await uploadDialog.getByRole("button", { name: "Uploaden en verifiëren" }).click();
    await expect(uploadDialog.getByText("1 van 1 gereed")).toBeVisible();

    await page.goto("/dashboard/screens?view=venue");
    await expect(page.getByRole("heading", { name: "Leg eerst de echte venue vast" })).toBeVisible();
    await page.getByLabel("Naam venue").fill("Sportpark De Horizon");
    await page.getByLabel("Locatie-aanduiding").fill("Hoofdlocatie");
    await page.getByRole("button", { name: "Venue toevoegen" }).click();
    await expect.poll(async () => {
      await page.reload();
      return page.getByText("Plattegrond instellen").count();
    }, { intervals: [1_000], timeout: 30_000 }).toBe(1);
    await page.getByText("Plattegrond instellen").click();
    await page.getByLabel("Naam", { exact: true }).fill("Begane grond");
    await page.getByRole("button", { name: "Kies uit Media" }).click();
    const resourcePicker = page.getByRole("dialog", { name: "Plattegrond uit Media kiezen" });
    await expect(resourcePicker.getByText("Venue plattegrond", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/media/resource-picker-1440x900.png" });
    await resourcePicker.getByRole("button", { name: /Venue plattegrond/ }).click();
    await expect(page.getByText(/Gekozen: Venue plattegrond/)).toBeVisible();
    await page.getByRole("button", { name: "Plattegrond opslaan" }).click();
    await expect.poll(async () => {
      await page.reload();
      return page.getByText("Zone toevoegen", { exact: true }).count();
    }, { intervals: [1_000], timeout: 30_000 }).toBeGreaterThan(0);
    await page.getByText("Zone toevoegen", { exact: true }).first().click();
    await page.getByLabel("Naam zone").fill("Clubhuis");
    await page.getByLabel("Omschrijving").fill("Publieke entree en kantine");
    await page.getByRole("button", { name: "Zone toevoegen" }).click();
    await expect.poll(async () => {
      await page.reload();
      return page.getByRole("combobox", { name: "Zone", exact: true }).getByRole("option", { name: "Clubhuis" }).count();
    }, { intervals: [1_000], timeout: 30_000 }).toBe(1);
    await page.getByRole("combobox", { name: "Scherm", exact: true }).selectOption({ label: "Pilot hoofdscherm" });
    await page.getByRole("combobox", { name: "Zone", exact: true }).selectOption({ label: "Clubhuis" });
    await page.getByLabel("X (0–1)").fill("0.32");
    await page.getByLabel("Y (0–1)").fill("0.64");
    await page.getByRole("button", { name: "Positie opslaan" }).click();
    await expect.poll(async () => {
      await page.reload();
      return page.getByText("32% × 64% · r1").count();
    }, { intervals: [1_000], timeout: 30_000 }).toBe(1);

    await expect(page.getByRole("heading", { name: "Sportpark De Horizon" })).toBeVisible();
    await expect(page.getByText("32% × 64% · r1")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
    await page.screenshot({ path: "docs/screenshots/vector-v2/control/venue-twin-1440x900.png" });

    await page.goto("/dashboard/screens?view=health");
    await expect(page.getByRole("heading", { name: "Echte telemetry, zonder schijnzekerheid" })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Echte telemetry, zonder schijnzekerheid" })
        .getByText("Niet gekoppeld", { exact: true })
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: "docs/screenshots/vector-v2/control/screen-health-1440x900.png" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/screens?view=venue");
    await expect(page.getByRole("heading", { name: "Toegankelijke lijstweergave" })).toBeVisible();
    const bounds = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.inner);
    await page.screenshot({ path: "docs/screenshots/vector-v2/control/venue-twin-390x844.png" });
  });
});

function generateTotp(secret: string, now = Date.now()) {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)) >>> 0;
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
  return Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? []);
}
