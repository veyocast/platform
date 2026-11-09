import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mountEffectivePlanning, planningFixture, planningOrigin, prepareEffectivePlanningFixture } from "../helpers/effective-planning-fixture";

test.beforeAll(prepareEffectivePlanningFixture);

for (const width of [320, 1440]) test(`PLN-01/02 actual database winner and first effective change remain readable at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const { errors } = await mountEffectivePlanning(page);
  const report = page.getByRole("region", { name: "Nu, Hierna en Waarom" });
  const columns = report.locator("dl > div");
  await expect(columns.nth(0)).toContainText("Rule 103");
  await expect(columns.nth(1)).toContainText("Rule 102");
  await expect(columns.nth(1)).not.toContainText("Rule 104");
  await expect(columns.nth(2)).toContainText("De tijdelijke overname");
  await expect(report).toContainText("geen passend framebewijs");
  await expect(report).toContainText("Alleen-lezen vooruitblik");
  await page.getByText("Andere passende regels (3)", { exact: true }).click();
  await expect(report.getByText("Rule 101", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath(`effective-planning-${width}.png`), fullPage: true });
});

test("PLN-04 publication check is explicit, read only and ignores a response for an old screen selection", async ({ page }) => {
  let calls = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${planningOrigin}/preview`, async route => {
    calls++;
    expect(route.request().postDataJSON().kind).toBe("publication");
    await pending;
    await route.fulfill({ json: { report: planningFixture.current, error: null } });
  });
  await mountEffectivePlanning(page, "publication");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Nu, Hierna en Waarom controleren", exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole("combobox", { name: "Scherm", exact: true }).selectOption(planningFixture.proposal.screens.find((screen: { screenId: string }) => screen.screenId !== planningFixture.current.screens[0].screenId).screenId);
  release();
  await expect(page.getByRole("button", { name: "Nu, Hierna en Waarom controleren", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Nu, Hierna en Waarom" })).toHaveCount(0);
  expect(calls).toBe(1);
});

test("PLN-04 publication preview reports a failed read without publishing", async ({ page }) => {
  let calls = 0;
  await page.route(`${planningOrigin}/preview`, route => { calls++; return route.fulfill({ status: 503 }); });
  await mountEffectivePlanning(page, "publication");
  await page.getByRole("button", { name: "Nu, Hierna en Waarom controleren", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("er is niets gepubliceerd");
  await expect(page.getByRole("region", { name: "Nu, Hierna en Waarom" })).toHaveCount(0);
  expect(calls).toBe(1);
});

test("PLN-04 schedule concept uses the same database report and explains that no assignment was saved", async ({ page }) => {
  let calls = 0;
  await page.route(`${planningOrigin}/preview`, route => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ kind: "schedule", input: { name: "Voorgenomen overname" } });
    return route.fulfill({ json: { report: planningFixture.proposal, error: null } });
  });
  await mountEffectivePlanning(page, "schedule");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Nu, Hierna en Waarom van dit concept", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Nu, Hierna en Waarom" })).toContainText("Voorstel; er is niets opgeslagen of toegewezen");
  await expect(page.getByRole("heading", { name: "Kantine", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entree", exact: true })).toBeVisible();
  expect(calls).toBe(1);
});
