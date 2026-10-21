import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mountScreenFlow, prepareScreenFlowFixture, screenFlowFixture, screenFlowId as id } from "../helpers/sync-screen-flow-fixture";

test.beforeAll(prepareScreenFlowFixture);
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus && !page.isClosed()) await page.screenshot({ path: info.outputPath("actual-failure.png"), fullPage: true }); });
for (const width of [390, 1440]) test(`actual Source screen picker retains its guarded immutable review and error return at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await mountScreenFlow(page), trigger = page.getByRole("button", { name: "Playlist toewijzen", exact: true });
  await trigger.click(); const dialog = page.getByRole("dialog", { name: "Playlist klaarzetten", exact: true });
  await expect(dialog).toHaveCSS("opacity", "1");
  await expect(dialog.getByRole("combobox", { name: "Playlist", exact: true })).toHaveValue(id(2));
  const link = dialog.getByRole("link", { name: "Publicatie controleren", exact: true });
  await expect(link).toHaveAttribute("href", `/dashboard/publications/${id(2)}?screens=${id(3)}#opnieuw-toewijzen`);
  await dialog.getByRole("combobox", { name: "Playlist", exact: true }).selectOption(id(9));
  await expect(link).toHaveAttribute("href", `/dashboard/publications/${id(9)}?screens=${id(3)}#opnieuw-toewijzen`);
  await dialog.getByRole("combobox", { name: "Playlist", exact: true }).selectOption(id(2));
  for (const box of await dialog.locator("select,a,button").evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height }; }))) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
  expect(await dialog.locator("label").evaluateAll(elements => elements.every(element => parseFloat(getComputedStyle(element).fontSize) >= 14))).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("actual-assignment-picker.png") }); expect(state.commands).toEqual([]);
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("link", { name: "Publicatie controleren", exact: true }).click();
  const review = page.locator("#opnieuw-toewijzen");
  await expect(review.locator('input[name="screenIds"]:checked')).toHaveCount(1); await expect(review.locator(`input[name="screenIds"][value="${id(3)}"]`)).toBeChecked();
  await expect(review.locator(`input[name="screenIds"][value="${id(7)}"]`)).not.toBeChecked();
  await expect(page.getByRole("link", { name: /Terug naar Eigen kantinescherm/ })).toHaveAttribute("href", `/dashboard/screens/${id(3)}`);
  expect(await page.locator('form[method="get"]').evaluate(form => new FormData(form as HTMLFormElement).get("screens"))).toBe(id(3));
  await expect(review.locator('input[name="confirmImmutable"]')).not.toBeChecked(); expect(state.commands).toEqual([]);
  state.respond(() => ({ href: `/dashboard/publications/${id(2)}?screens=${id(3)}&fout=${encodeURIComponent("Eigen transportafwijzing; controleer opnieuw.")}#opnieuw-toewijzen` }));
  await review.locator('input[name="confirmImmutable"]').check(); await review.getByRole("button", { name: "Bestaande release toewijzen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Eigen transportafwijzing");
  await expect(review.locator(`input[name="screenIds"][value="${id(3)}"]`)).toBeChecked(); await expect(review.locator(`input[name="screenIds"][value="${id(7)}"]`)).not.toBeChecked();
  expect(state.commands).toHaveLength(1); expect(state.commands[0]!.kind).toBe("reassign"); const fields = Object.fromEntries(state.commands[0]!.input);
  expect(fields).toMatchObject({ releaseId: id(2), screenIds: id(3), screenContext: id(3), confirmImmutable: "on" });
  expect(fields.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("actual-assignment-review-error.png") }); expect(state.errors).toEqual([]);
});

test("an unavailable current playlist requires an explicit choice instead of silently selecting another", async ({ page }) => {
  const fixture = screenFlowFixture(); fixture.screenData.assignableReleases = fixture.screenData.assignableReleases.slice(1);
  const state = await mountScreenFlow(page, fixture); await page.getByRole("button", { name: "Playlist toewijzen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Playlist klaarzetten", exact: true });
  await expect(dialog.getByRole("combobox", { name: "Playlist", exact: true })).toHaveValue("");
  await expect(dialog.getByRole("link", { name: "Publicatie controleren", exact: true })).toHaveCount(0);
  await dialog.getByRole("combobox", { name: "Playlist", exact: true }).selectOption(id(9));
  await expect(dialog.getByRole("link", { name: "Publicatie controleren", exact: true })).toHaveAttribute("href", `/dashboard/publications/${id(9)}?screens=${id(3)}#opnieuw-toewijzen`);
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]);
});

test("empty and failed reads never offer a draft publication or a write", async ({ page }) => {
  const fixture = screenFlowFixture(); fixture.screenData.assignableReleases = [];
  const state = await mountScreenFlow(page, fixture); await page.getByRole("button", { name: "Playlist toewijzen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Playlist klaarzetten", exact: true });
  await expect(dialog).toContainText("Nog geen gepubliceerde playlist"); await expect(dialog.getByRole("combobox")).toHaveCount(0); await expect(dialog.getByRole("link", { name: "Publicatie controleren", exact: true })).toHaveCount(0);
  fixture.screenData.error = "De schermvloot kon niet volledig worden geladen. Vernieuw de pagina.";
  await page.reload(); await page.getByRole("button", { name: "Playlist toewijzen", exact: true }).click();
  await expect(dialog).toContainText("De publicatiekeuze kon niet worden geladen"); await expect(dialog.getByRole("combobox")).toHaveCount(0);
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]);
});

test("the actual readonly page retains disabled assignment and review controls", async ({ page }) => {
  const fixture = screenFlowFixture(); fixture.session.capabilities = ["tenant.screen.read", "tenant.release.read"];
  const state = await mountScreenFlow(page, fixture); await expect(page.getByRole("button", { name: "Playlist toewijzen", exact: true })).toBeDisabled();
  await page.goto(`http://127.0.0.1:3389/dashboard/publications/${id(2)}?screens=${id(3)}`);
  const targets = page.locator('#opnieuw-toewijzen input[name="screenIds"]'); await expect(targets).toHaveCount(2);
  for (const target of await targets.all()) await expect(target).toBeDisabled();
  await expect(page.getByRole("button", { name: "Bestaande release toewijzen", exact: true })).toBeDisabled();
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]);
});

test("foreign malformed repeated disabled and blocked query context never selects an alternate screen", async ({ page }) => {
  const fixture = screenFlowFixture(), state = await mountScreenFlow(page, fixture);
  const contexts = [id(99), "garbage", "", `${id(3)}&screens=${id(7)}`];
  for (const context of contexts) {
    await page.goto(`http://127.0.0.1:3389/dashboard/publications/${id(2)}?screens=${context}`);
    await expect(page.locator('#opnieuw-toewijzen input[name="screenIds"]:checked')).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("Er is geen ander scherm geselecteerd");
  }
  for (const kind of ["disabled", "blocked"]) {
    fixture.releaseData.screenStates[0]!.screen.status = kind === "disabled" ? "disabled" : "active";
    fixture.releaseData.screenStates[0]!.preflight.status = kind === "blocked" ? "blocked" : "ready";
    await page.goto(`http://127.0.0.1:3389/dashboard/publications/${id(2)}?screens=${id(3)}`);
    await expect(page.locator('#opnieuw-toewijzen input[name="screenIds"]:checked')).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("Er is geen ander scherm geselecteerd");
  }
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]);
});
