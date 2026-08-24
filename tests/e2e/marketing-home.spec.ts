import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;

test("renders the marketing homepage with canon-safe messaging", async ({ page }) => {
  await page.goto(marketingURL);

  await expect(page).toHaveTitle(
    "Living Venue OS voor ieder scherm | VeyoCast"
  );
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Elk scherm. Elk bericht. Elk moment."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan een demo" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Bouw je opstelling" }).first()).toBeVisible();
  await expect(page.getByText("Immutable releases", { exact: true })).toBeVisible();
  await expect(page.getByText("Last-known-good", { exact: true })).toBeVisible();
  await expect(page.getByText("Server-side bevoegdheden", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Bouw je opstelling" }).first().click();
  await expect(page).toHaveURL(/#opstelling$/);
  await expect(page.getByRole("heading", { name: "Bouw je VeyoCast-opstelling." })).toBeVisible();
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
