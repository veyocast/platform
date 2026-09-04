import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("renders the marketing homepage with canon-safe messaging", async ({ page }) => {
  await page.goto(marketingURL);

  await expect(page).toHaveTitle(
    "Van clubverhaal naar ieder scherm | VeyoCast"
  );
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Van clubverhaal naar ieder scherm."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan een demo" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Bekijk hoe het werkt" }).first()).toBeVisible();
  await expect(page.getByText("Binnen minuten live", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Direct zien wat er speelt." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ieder moment voelt als maatwerk." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eén platform voor de hele club." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meer clubgevoel. Minder beheer." })).toBeVisible();
  await expect(
    page.locator(".prototype-price__card").getByText("€ 5,95", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Verenigingscommunicatie die vanzelf stroomt.", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Bekijk hoe het werkt" }).first().click();
  await expect(page).toHaveURL(/#opstelling$/);
  await expect(page.getByRole("heading", { name: "Bouw je VeyoCast-opstelling." })).toBeVisible();
});

test("keeps hero overlays in front and separates the setup columns", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(`${marketingURL}/#opstelling`);

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".prototype-hero__stage");
    const media = document.querySelector<HTMLElement>(".prototype-hero__media");
    const chip = document.querySelector<HTMLElement>(".prototype-stage-chip--top");
    const player = document.querySelector<HTMLElement>(".prototype-player-bar");
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
  await page.goto(`${marketingURL}/#opstelling`);

  const summary = page.getByRole("complementary", { name: "Samenvatting van je opstelling" });
  await expect(summary.getByRole("heading", { name: "1 scherm" })).toBeVisible();
  await page.getByRole("button", { name: "Scherm toevoegen aan Kantine & ontmoetingsplek" }).click();
  await expect(summary.getByRole("heading", { name: "2 schermen" })).toBeVisible();
  await expect(summary.getByText("€ 11,90", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /YouTube/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Engage/ })).toBeDisabled();

  await summary.getByRole("button", { name: "Neem deze opstelling mee" }).click();
  await expect(page).toHaveURL(/\/demo\?setup=/);
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 3,
      name: "Je opstelling staat klaar."
    })
  ).toBeVisible();
  await expect(page.getByText("Sportvereniging · 2 schermen · 3 bronnen")).toBeVisible();
  await expect(page.getByText("€ 11,90 per maand daarna")).toBeVisible();
  await expect(page.getByLabel("Type organisatie")).toHaveValue("Sportvereniging");
  await expect(page.getByLabel("Geschat aantal schermen")).toHaveValue("2–5 schermen");
});

test("keeps the setup journey usable as a mobile stepper", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(`${marketingURL}/#opstelling`);

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
