import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { mountScreenFlow, prepareScreenFlowFixture, screenFlowId as id } from "../helpers/sync-screen-flow-fixture";

test.beforeAll(prepareScreenFlowFixture);
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus && !page.isClosed()) await page.screenshot({ path: info.outputPath("actual-failure.png"), fullPage: true }); });
for (const width of [390, 1440]) test(`actual layout wizard preserves zones preview and command while task controls are readable at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); const state = await mountScreenFlow(page, undefined, `/dashboard/screens/${id(3)}?tab=layout`);
  await page.getByRole("button", { name: "Schermindeling", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Je scherm indelen", exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog).toHaveCSS("opacity", "1"); await page.screenshot({ path: info.outputPath("actual-layout-first-step.png") });
  const text = await dialog.locator('[class*="layoutControls"] > p,[class*="wizardSteps"] li,[class*="layoutChoices"] strong,label.field > span').evaluateAll(elements => elements.map(element => ({ text: element.textContent, size: parseFloat(getComputedStyle(element).fontSize) })));
  expect(text.length).toBeGreaterThan(5); for (const field of text) expect(field.size, field.text!).toBeGreaterThanOrEqual(14);
  for (const target of await dialog.locator("select,button").evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.getAttribute("aria-label") || element.textContent, width: r.width, height: r.height }; }))) { expect(target.width, target.name!).toBeGreaterThanOrEqual(44); expect(target.height, target.name!).toBeGreaterThanOrEqual(44); }
  await dialog.getByRole("button", { name: "Drie zones", exact: true }).click(); await dialog.getByRole("combobox", { name: "Oriëntatie", exact: true }).selectOption("portrait");
  await expect(dialog.locator('[class*="layoutPreview"][data-kind="three"]')).toHaveAttribute("data-portrait", "true");
  await dialog.getByRole("button", { name: "Volgende", exact: true }).click();
  for (const name of ["Hoofdvlak", "Zijbalk", "Onderbalk"]) await dialog.getByRole("combobox", { name, exact: true }).selectOption(`playlist:${id(8)}`);
  const slider = dialog.getByRole("slider", { name: "Breedte hoofdvlak", exact: true }); await slider.fill("75"); expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog).toContainText("Staand (9:16)"); expect(state.commands).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("actual-layout-review.png") }); await dialog.getByRole("button", { name: "Indeling opslaan", exact: true }).click();
  await expect.poll(() => state.commands.length).toBe(1);
  expect(state.commands[0]).toMatchObject({ kind: "composition", input: { targets: [{ screenId: id(3), expectedDraftRevision: 0 }], configuration: { layout: "three", orientation: "portrait", mainWidthPercent: 75, bottomHeightPercent: 20, zones: ["main", "side", "bottom"].map(zone => ({ id: zone, content: `playlist:${id(8)}` })) }, seriesRevisions: {} } });
  expect(state.errors).toEqual([]);
});

for (const width of [390, 1440]) test(`actual hours captures primary task and retains schedule support and history at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); const state = await mountScreenFlow(page, undefined, `/dashboard/screens/${id(3)}?tab=hours`);
  await expect(page.getByRole("heading", { name: "Bedrijfstijden en startgedrag", exact: true })).toBeVisible();
  const metrics = await page.evaluate(() => {
    const form = document.querySelector('form:has(input[name="settingsJson"])')!, facts = document.getElementById("capabilities-title")!;
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height, width: r.width }; };
    return { form: rect(form), facts: rect(facts.closest("details")?.querySelector("summary") ?? facts), pageHeight: document.documentElement.scrollHeight, viewport: innerHeight, taskText: [...form.querySelectorAll("p,label > span")].map(element => ({ text: element.textContent, size: parseFloat(getComputedStyle(element).fontSize) })) };
  });
  const geometryPath = info.outputPath("actual-hours-geometry.json"); writeFileSync(geometryPath, JSON.stringify(metrics, null, 2));
  await info.attach("actual-hours-geometry", { path: geometryPath, contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("actual-hours-full-page.png"), fullPage: true }); expect(state.commands).toEqual([]);
  // The primary schedule precedes secondary device facts, which remain reachable.
  expect(metrics.form.top).toBeLessThan(metrics.facts.top);
  for (const field of metrics.taskText) expect(field.size, field.text!).toBeGreaterThanOrEqual(14);
  await expect(page.getByRole("combobox", { name: "Schematype", exact: true })).toHaveValue("weekly");
  await expect(page.getByText("Meerdere perioden per dag zijn mogelijk.", { exact: true })).toBeVisible();
  const form = page.locator('form:has(input[name="settingsJson"])'), advanced = form.locator("details");
  const originalSettings = JSON.parse(await form.locator('input[name="settingsJson"]').inputValue());
  await advanced.locator("summary").click(); await page.getByRole("switch", { name: "Automatisch starten", exact: true }).check();
  await expect(advanced).toHaveAttribute("open", "");
  expect(JSON.parse(await form.locator('input[name="settingsJson"]').inputValue())).toEqual({ ...originalSettings, startupEnabled: true });
  await page.getByRole("switch", { name: "Automatisch starten", exact: true }).uncheck(); await advanced.locator("summary").click();
  expect(JSON.parse(await form.locator('input[name="settingsJson"]').inputValue())).toEqual(originalSettings);
  for (const target of await form.locator('button:visible,input:not([type=hidden]):visible,select:visible,summary:visible').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.getAttribute("aria-label") || element.textContent, width: r.width, height: r.height }; }))) { expect(target.width, target.name!).toBeGreaterThanOrEqual(44); expect(target.height, target.name!).toBeGreaterThanOrEqual(44); }
  for (const name of ["Apparaatondersteuning", "Compatibiliteit en installatie", "Test- en uitvoeringshistorie"]) {
    const disclosure = page.locator("details").filter({ has: page.locator("summary", { hasText: name }) });
    if (await disclosure.count()) await disclosure.locator("summary").click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("BRAVIA Sync", { exact: true })).toBeVisible(); await expect(page.getByText(/fysieke TV-beeld blijft een handmatige stap/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]);
});
