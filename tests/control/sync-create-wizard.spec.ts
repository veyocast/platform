import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { SyncCreateWizardData } from "../../apps/control/app/(shell)/dashboard/studio/sync-create-wizard-types";
import { fixture, id, mount, next, origin, prepareWizardFixture, toReview } from "../helpers/sync-create-wizard-fixture";

test.beforeAll(prepareWizardFixture);

for (const width of [390, 1440]) {
  test(`Source wizard keeps inputs, full previews, touch targets and accessibility at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const state = await mount(page);
    await next(page); await page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true }).fill("Mijn eigen ontvangstscherm");
    await page.getByRole("textbox", { name: "Eigen toelichting", exact: true }).fill("Welkom op ons sportpark.");
    await next(page); await page.getByRole("button", { name: "Staand · 9:16", exact: true }).click();
    await page.getByRole("combobox", { name: "Achtergrond", exact: true }).selectOption("photo");
    await expect(page.getByRole("combobox", { name: "Achtergrondfoto", exact: true })).toHaveValue(id(20));
    await page.getByRole("button", { name: "Vorige", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true })).toHaveValue("Mijn eigen ontvangstscherm");
    await page.reload(); await expect(page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true })).toHaveValue("Mijn eigen ontvangstscherm");
    await next(page); await expect(page.getByRole("button", { name: "Staand · 9:16", exact: true })).toHaveAttribute("aria-pressed", "true");
    const imageReferences = await page.evaluate(() => Object.values(sessionStorage).join("\n"));
    expect(imageReferences).not.toContain("http:"); expect(imageReferences).toContain("checksumSha256");
    const bounds = await page.getByLabel("Voorbeeld van je ontwerp").locator(".vc-slide-preview").boundingBox();
    expect(bounds!.height / bounds!.width).toBeCloseTo(16 / 9, 2);
    await info.attach("actual-design-step", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await next(page); expect(state.creates).toEqual([]);
    const primary = page.getByRole("button", { name: "Ontwerp maken", exact: true });
    expect(await primary.evaluate(button => getComputedStyle(button).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const targets = await page.locator("button:visible:not(:disabled)").evaluateAll(buttons => buttons.map(button => ({ name: button.textContent, height: button.getBoundingClientRect().height })));
    for (const target of targets) expect(target.height, target.name ?? "button").toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach("actual-four-step-wizard", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
    await expect.poll(() => state.creates.length).toBe(1);
    expect(state.creates[0]!.scope).toBe(fixture().actorScope);
    const command = state.creates[0]!.input; expect(command.kind).toBe("manual");
    if (command.kind !== "manual") throw Error("manual");
    expect(command.document.syncPresentation).toMatchObject({ name: "Mijn eigen ontvangstscherm", body: "Welkom op ons sportpark.", orientation: "portrait", style: { backgroundAsset: { kind: "tenant", mediaAssetId: id(20), checksumSha256: "a".repeat(64) } } });
    expect(JSON.stringify(command)).not.toContain(origin);
    expect(state.errors).toEqual([]);
  });
}

test("real team controls and read-only preview precede one direct source command; lost response replays exact original", async ({ page }) => {
  const state = await mount(page, fixture("standings", true), { dropFirst: true });
  await page.getByRole("combobox", { name: "Gekoppelde bron", exact: true }).selectOption(id(3));
  await next(page); await page.getByRole("combobox", { name: "Team", exact: true }).selectOption("own-team");
  await page.getByRole("combobox", { name: "Competitie · Eigen eerste team", exact: true }).selectOption("0");
  await next(page); await next(page);
  expect(state.creates).toEqual([]); expect(state.previews).toEqual([]);
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true })).toBeEnabled();
  expect(state.creates).toHaveLength(1); expect(state.receipts.size).toBe(1);
  const original = state.creates[0]!.input; expect(original.kind).toBe("connected");
  if (original.kind !== "connected" || !("configuration" in original.command.request)) throw Error("source");
  expect(original).not.toHaveProperty("document");
  expect(original.command.request.configuration.context).toMatchObject({ providerTeamId: "own-team", competitionSelectionMode: "pinned", poolId: "pool" });
  expect(original.command.request.configuration.syncConfiguration).toMatchObject({ seed: { rows: [], news: [] } });
  await page.reload(); await page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true }).click();
  await expect.poll(() => state.creates.length).toBe(2); expect(state.creates[1]).toEqual(state.creates[0]); expect(state.receipts.size).toBe(1); expect(state.previews).toHaveLength(1);
  await expect.poll(() => page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited)).toEqual([`/dashboard/slides/${id(8)}`]);
  expect(state.errors).toEqual([]);
});

test("a failed RSS source keeps approved cached content visible with warnings and exact receipt recovery", async ({ page }) => {
  const props = fixture("rss", true);
  props.sources[0] = { ...props.sources[0]!, kind: "rss", providerStatus: "error", lastSuccessfulSyncAt: null, lastErrorCode: "RSS_UNAVAILABLE" };
  const state = await mount(page, props, { dropFirst: true });
  await page.route(`${origin}/__wizard/preview`, route => {
    const body = route.request().postDataJSON(); state.previews.push(body);
    return route.fulfill({ json: { ok: true, presentation: { ...body.input.configuration.syncConfiguration.seed, news: [{ title: "Eerder opgeslagen clubbericht", intro: "Dit goedgekeurde bericht blijft beschikbaar.", source: "Eigen club" }] }, assets: {}, source: { providerStatus: "error", lastSuccessfulSyncAt: null, lastErrorCode: "RSS_UNAVAILABLE" } } });
  });
  await page.getByRole("combobox", { name: "Gekoppelde bron", exact: true }).selectOption(id(3));
  await expect(page.getByRole("status", { name: "Status van de bron", exact: true })).toContainText("bronverwerking is mislukt");
  await expect(page.getByRole("status", { name: "Status van de bron", exact: true }).getByRole("link", { name: "Bronnen bekijken" })).toHaveAttribute("href", "/dashboard/sources");
  await toReview(page);
  await expect(page.getByRole("status", { name: "Status van de bron", exact: true })).toContainText("laatst goedgekeurde gegevens");
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click();
  const preview = page.getByRole("complementary", { name: "Voorbeeld van je ontwerp" });
  await expect(preview.getByText("Eerder opgeslagen clubbericht", { exact: true })).toBeVisible();
  await expect(preview.getByText("Opgeslagen bronpreview", { exact: true })).toBeVisible();
  await expect(preview.getByRole("status", { name: "Status van de bronpreview", exact: true })).toContainText("Nieuwe live gegevens zijn hiermee niet bevestigd");
  await expect(page.getByText("Opgeslagen broninhoud gecontroleerd", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeEnabled();
  expect(state.creates).toEqual([]);
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  const retry = page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true });
  await expect(retry).toBeEnabled();
  await expect(preview.getByText("Eerder opgeslagen clubbericht", { exact: true })).toBeVisible();
  const original = state.creates[0]!.input;
  if (original.kind !== "connected" || !("configuration" in original.command.request)) throw Error("connected source required");
  expect(original.command.request.configuration.syncConfiguration.seed.news).toEqual([]);
  await page.reload();
  await expect(page.getByRole("status", { name: "Status van de bron", exact: true })).toContainText("bronverwerking is mislukt");
  await retry.click(); await expect.poll(() => state.creates.length).toBe(2);
  expect(state.creates[1]).toEqual(state.creates[0]); expect(state.previews).toHaveLength(1); expect(state.receipts.size).toBe(1); expect(state.errors).toEqual([]);
});

test("a changed design or denied preview cannot create with an obsolete successful preview", async ({ page }) => {
  const state = await mount(page, fixture("menu", true));
  await page.getByRole("combobox", { name: "Gekoppelde bron", exact: true }).selectOption(id(3)); await toReview(page);
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click(); await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Vorige", exact: true }).click(); await page.getByRole("button", { name: "Staand · 9:16", exact: true }).click(); await next(page);
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled(); expect(state.creates).toEqual([]);
  await page.route(`${origin}/__wizard/preview`, route => route.fulfill({ json: { ok: false, error: "De bronrechten zijn niet bevestigd. Je invoer is behouden; controleer Bronnen." } }));
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("bronrechten");
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled(); expect(state.creates).toEqual([]); expect(state.errors).toEqual([]);
});

test("browser storage failure blocks POST and preserves the visible draft", async ({ page }) => {
  const state = await mount(page); await toReview(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("No capacity", "QuotaExceededError"); }; });
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("browser kan de invoer niet veilig bewaren"); expect(state.creates).toEqual([]);
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled(); expect(state.errors).toEqual([]);
});

test("a refusal during receipt recovery preserves the earlier possibly committed body and nonce across reload", async ({ page }) => {
  const state = await mount(page, fixture(), { dropFirst: true, rejectReplayOnce: true }); await toReview(page);
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  const retry = page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true });
  await expect(retry).toBeEnabled(); await retry.click();
  await expect(page.getByRole("alert")).toContainText("tijdelijk gepauzeerd");
  await expect(retry).toBeEnabled(); expect(state.creates).toHaveLength(2); expect(state.creates[1]).toEqual(state.creates[0]);
  const retained = await page.evaluate(() => Object.values(sessionStorage).map(value => JSON.parse(value)).find(value => value.pending));
  expect(retained.pending).toEqual(state.creates[0]!.input);
  await page.reload(); await retry.click();
  await expect.poll(() => state.creates.length).toBe(3); expect(state.creates[2]).toEqual(state.creates[0]); expect(state.receipts.size).toBe(1); expect(state.errors).toEqual([]);
});

test("temporarily incomplete source names and duration survive back, reload and repair without crashing or submitting", async ({ page }) => {
  const state = await mount(page, fixture("menu", true));
  await page.getByRole("combobox", { name: "Gekoppelde bron", exact: true }).selectOption(id(3)); await next(page);
  await page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true }).fill("");
  await next(page); await expect(page.getByRole("alert")).toContainText("naam van 2 tot 120 tekens");
  await page.reload(); await expect(page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true }).fill("Eigen menukaart"); await next(page);
  await page.getByRole("spinbutton", { name: "Seconden per pagina", exact: true }).fill(""); await next(page);
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Vorige", exact: true }).click();
  await page.reload(); await expect(page.getByRole("spinbutton", { name: "Seconden per pagina", exact: true })).toHaveValue("");
  await page.getByRole("spinbutton", { name: "Seconden per pagina", exact: true }).fill("5"); await next(page);
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeEnabled();
  expect(state.creates).toEqual([]); expect(state.errors).toEqual([]);
});

test("an actor switch discards neither original journal nor scope and ignores the stale create response", async ({ page }) => {
  const props = fixture(), state = await mount(page, props, { delayedCreate: true }); await toReview(page);
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click(); await expect.poll(() => state.creates.length).toBe(1);
  await page.evaluate(nextData => (globalThis as typeof globalThis & { changeWizardData: (value: SyncCreateWizardData) => void }).changeWizardData(nextData), { ...props, actorScope: `${props.tenantId}:${id(9)}` });
  await expect(page.getByRole("heading", { name: "Bron", exact: true })).toBeVisible(); await state.finish();
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited ?? [])).toEqual([]);
  const originalJournal = await page.evaluate(() => Object.values(sessionStorage).map(value => JSON.parse(value)).find(value => value.pending));
  expect(originalJournal.actorScope).toBe(props.actorScope); expect(originalJournal.pending).toEqual(state.creates[0]!.input); expect(state.errors).toEqual([]);
});

test("missing source offers a real manual fallback and a viewer cannot start creation", async ({ page }) => {
  const props = fixture("menu", true); props.sources = []; const state = await mount(page, props);
  await expect(page.getByText("Er is nog geen geschikte bron beschikbaar", { exact: true })).toBeVisible();
  await next(page); await expect(page.getByRole("alert")).toContainText("Kies een beschikbare bron"); expect(state.creates).toEqual([]);
  await page.getByRole("button", { name: "Zelf samenstellen", exact: false }).click(); await next(page);
  await expect(page.getByRole("textbox", { name: "Inhoudsregels", exact: true })).toBeVisible();
  await page.evaluate(nextData => (globalThis as typeof globalThis & { changeWizardData: (value: SyncCreateWizardData) => void }).changeWizardData(nextData), { ...props, actorScope: `${props.tenantId}:${id(9)}`, canCreateManual: false, canCreateConnected: false });
  await expect(page.getByRole("button", { name: "Verder", exact: true })).toBeDisabled(); expect(state.creates).toEqual([]);
});

test("Engage and YouTube use their existing verified pickers and keep online fallback boundaries", async ({ page }) => {
  const state = await mount(page, fixture("youtube")); await next(page);
  await page.getByRole("combobox", { name: "Gecontroleerde YouTube-bron", exact: true }).selectOption("https://www.youtube.com/watch?v=abcdefghijk");
  await expect(page.getByText("Online video met je eigen lokale kaart", { exact: true })).toBeVisible();
  await next(page); await next(page); expect(state.creates).toEqual([]);
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click(); await expect.poll(() => state.creates.length).toBe(1);
  const first = state.creates[0]!.input; if (first.kind !== "manual") throw Error("manual"); expect(first.document.syncPresentation?.youtubeUrl).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  await page.evaluate(nextData => (globalThis as typeof globalThis & { changeWizardData: (value: SyncCreateWizardData) => void }).changeWizardData(nextData), fixture("engage"));
  await next(page); await expect(page.getByRole("combobox", { name: "Gekoppelde publieksvraag", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Gekoppelde publieksvraag", exact: true }).locator("option")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Gekoppelde publieksvraag", exact: true }).selectOption(id(31));
  await expect(page.getByRole("combobox", { name: "Gekoppelde publieksvraag", exact: true })).toHaveValue(id(31));
  await next(page); await next(page); await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect.poll(() => state.creates.length).toBe(2);
  const second = state.creates[1]!.input; if (second.kind !== "manual") throw Error("manual");
  expect(second.document.syncPresentation?.poll).toMatchObject({ id: id(31), status: "live", visibility: "live", options: [{ votes: 0 }, { votes: 0 }] });
  expect(state.reads).toContain("engage-choices"); expect(state.errors).toEqual([]);
});
