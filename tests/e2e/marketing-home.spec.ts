import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("renders the supplied Sync homepage and real workspace links", async ({ page }) => {
  await page.goto(marketingURL);
  await expect(page).toHaveTitle("VeyoCast — Narrowcasting die je verhaal laat zien");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maak van iederscherm eenverhaal.");
  await expect(page.getByRole("link", { name: "Ontdek het platform", exact: true })).toHaveAttribute("href", "https://control.veyocast.nl");
  await expect(page.locator(".mk-hero-art img")).toHaveAttribute("src", /brand-hero/);
  await expect(page.getByRole("heading", { name: "Mooi op het scherm. Rustig achter de schermen." })).toBeVisible();
  await expect(page.locator(".mk-footer-bottom")).not.toContainText("Geen live dienst");
  await page.goto(`${marketingURL}/players`);
  await expect(page.getByRole("link", {name:"Beleef de player",exact:true})).toHaveAttribute("href", process.env.NEXT_PUBLIC_PLAYER_URL ?? "https://player.veyocast.nl");
});

test("keeps hero overlays in front and separates the setup columns", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(`${marketingURL}/opstelling#opstelling`);

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-sites="hero-stage"]');
    const media = document.querySelector<HTMLElement>('[data-sites="hero-media"]');
    const chip = document.querySelector<HTMLElement>('[data-sites="hero-top-chip"]');
    const player = document.querySelector<HTMLElement>('[data-sites="hero-player-bar"]');
    const map = document.querySelector<HTMLElement>(".setup-builder__venue-map");
    const zones = document.querySelector<HTMLElement>(".setup-builder__zone-list");

    if (!stage || !media || !chip || !player || !map || !zones) return null;

    const mapRect = map.getBoundingClientRect();
    const zonesRect = zones.getBoundingClientRect();

    return {
      chipZIndex: Number.parseInt(getComputedStyle(chip).zIndex, 10),
      columnGap: zonesRect.left - mapRect.right,
      mediaOverflow: getComputedStyle(media).overflow,
      playerZIndex: Number.parseInt(getComputedStyle(player).zIndex, 10),
      stageOverflow: getComputedStyle(stage).overflow
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry?.stageOverflow).toBe("visible");
  expect(geometry?.mediaOverflow).toBe("hidden");
  expect(geometry?.chipZIndex).toBeGreaterThanOrEqual(2);
  expect(geometry?.playerZIndex).toBeGreaterThanOrEqual(2);
  expect(geometry?.columnGap).toBeGreaterThanOrEqual(32);
});

test("calculates and securely carries a venue setup into the demo journey", async ({ page }) => {
  await page.goto(`${marketingURL}/opstelling#opstelling`);

  const summary = page.getByRole("complementary", { name: "Samenvatting van je opstelling" });
  await expect(summary.getByRole("heading", { name: "1 scherm" })).toBeVisible();
  await page.getByRole("button", { name: "Scherm toevoegen aan Kantine & ontmoetingsplek" }).click();
  await expect(summary.getByRole("heading", { name: "2 schermen" })).toBeVisible();
  await expect(summary.getByText("€ 11,90", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /YouTube/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Engage/ })).toBeDisabled();

  await summary.getByRole("button", { name: "Neem deze opstelling mee" }).click();
  await expect(page).toHaveURL(/\/demo\?setup=/);
  await expect(page.getByText("Je opstelling is meegenomen: 2 schermen.")).toBeVisible();
  await expect(page.locator('input[name="setupIntent"]')).toHaveValue(/.+/);
  await expect(page.locator('select[name="organizationType"]')).toHaveValue("Sportvereniging");
  await expect(page.locator('select[name="screens"]')).toHaveValue("1–3");
});

test("keeps the setup journey usable as a mobile stepper", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(`${marketingURL}/opstelling#opstelling`);

  const stepper = page.getByRole("navigation", { name: "Stappen van de setup builder" });
  await expect(stepper.getByRole("button", { name: "1 Locatie" })).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(stepper.getByRole("button", { name: "2 Schermen" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("group", { name: "2. Plaats schermen in je locatie" })).toBeVisible();
  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(stepper.getByRole("button", { name: "3 Bronnen" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("button", { name: /YouTube/ })).toBeDisabled();
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(stepper.getByRole("button", { name: "2 Schermen" })).toHaveAttribute("aria-current", "step");
});
