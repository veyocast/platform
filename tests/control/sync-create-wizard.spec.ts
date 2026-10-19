import { syncBackgroundScenes } from "@veyocast/contracts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { SyncCreateWizardData } from "../../apps/control/app/(shell)/dashboard/studio/sync-create-wizard-types";
import { fixture, id, mount, next, origin, prepareWizardFixture, toReview } from "../helpers/sync-create-wizard-fixture";
import { syncDynamicConfigurationSchema } from "../../packages/contracts/src/sync-dynamic-configuration";
import { applySyncThemeCreationDefaults, syncThemeCreationStarterDefaults } from "../../apps/control/lib/sync-theme-creation-defaults";

test.beforeAll(prepareWizardFixture);

test("persisted new-design profiles drive the real preview and an explicit theme choice without changing own content", async ({ page }) => {
  const props = fixture();
  const saved = { ...syncThemeCreationStarterDefaults("onzetrots-tv"), accent: "#cAb123", font: "Georgia" as const, mode: "dark" as const, background: "stadium" as const, scale: 116, motion: "geen" as const, showLogo: false };
  props.themeDefaults = { schemaVersion: 1, tenantId: props.tenantId, defaultThemeId: "fieldflow", profiles: [
    { themeId: "fieldflow", themeVersion: "1.0.0", configured: false, revision: 0, defaults: null },
    { themeId: "onzetrots-tv", themeVersion: "11.0.0", configured: true, revision: 7, defaults: saved },
  ] };
  props.initialPresentation = applySyncThemeCreationDefaults(props.initialPresentation, "fieldflow", syncThemeCreationStarterDefaults("fieldflow"));
  const state = await mount(page, props); await next(page);
  await page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true }).fill("Mijn eigen verhaal");
  await page.getByRole("textbox", { name: "Eigen toelichting", exact: true }).fill("Onze echte toelichting blijft behouden."); await next(page);
  await expect(page.getByText("Dit thema is nog niet ingesteld", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "OnzeTrots TV", exact: true }).click();
  const preview = page.getByLabel("Voorbeeld van je ontwerp").locator(".vc-slide-preview");
  await expect(preview).toHaveClass(/is-trots/); await expect(preview).toHaveClass(/bg-stadium/);
  await expect(preview).toHaveCSS("font-family", "Georgia, serif");
  await expect.poll(() => preview.evaluate(element => getComputedStyle(element).getPropertyValue("--slide-accent").trim())).toBe("#cAb123");
  await expect(preview.locator(".vc-slide-brand")).toHaveCSS("visibility", "hidden");
  await next(page); await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click(); await expect.poll(() => state.creates.length).toBe(1);
  const original = state.creates[0]!.input; if (original.kind !== "manual") throw Error("manual");
  expect(original.document.syncPresentation).toMatchObject({ theme: "onzetrots-tv", name: "Mijn eigen verhaal", body: "Onze echte toelichting blijft behouden.", style: { accent: "#cAb123", font: "Serif", fontChanged: true, background: "stadium", scale: 116, motion: "geen", showLogo: false } });
  expect(JSON.stringify(original)).not.toContain(origin); expect(state.errors).toEqual([]);
});

test("a failed defaults read blocks a fresh command but never rewrites or blocks an already pending receipt replay", async ({ page }) => {
  const props = fixture(), state = await mount(page, props, { dropFirst: true }); await toReview(page);
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true })).toBeEnabled();
  const original = JSON.stringify(state.creates[0]);
  props.themeDefaultsError = "De opgeslagen themavoorkeuren konden niet worden bevestigd. Laad opnieuw.";
  props.initialPresentation = applySyncThemeCreationDefaults(props.initialPresentation, "fieldflow", { ...syncThemeCreationStarterDefaults("fieldflow"), accent: "#000000" });
  await page.reload(); await expect(page.getByRole("alert")).toContainText("themavoorkeuren konden niet worden bevestigd");
  await page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true }).click(); await expect.poll(() => state.creates.length).toBe(2);
  expect(JSON.stringify(state.creates[1])).toBe(original); expect(state.receipts.size).toBe(1); expect(state.errors).toEqual([]);
  await page.evaluate(nextData => (globalThis as typeof globalThis & { changeWizardData: (value: SyncCreateWizardData) => void }).changeWizardData(nextData), { ...props, actorScope: `${props.tenantId}:${id(9)}` });
  await expect(page.getByRole("heading", { name: "Bron", exact: true })).toBeVisible(); await toReview(page);
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeDisabled(); expect(state.creates).toHaveLength(2);
});

for (const width of [390, 1440]) {
  test(`Source wizard keeps inputs, full previews, touch targets and accessibility at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const state = await mount(page);
    await next(page); await page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true }).fill("Mijn eigen ontvangstscherm");
    await expect(page.getByText("Naam van je ontwerp", { exact: true })).toHaveCSS("font-size", "14px");
    await expect(page.getByText("Eigen toelichting", { exact: true })).toHaveCSS("font-size", "14px");
    await page.getByRole("textbox", { name: "Eigen toelichting", exact: true }).fill("Welkom op ons sportpark.");
    await next(page); await page.getByRole("button", { name: "Staand · 9:16", exact: true }).click();
    await page.getByRole("button", { name: "Eigen foto kiezen", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Achtergrondfoto", exact: true })).toHaveValue(id(20));
    await page.getByRole("button", { name: "Vorige", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true })).toHaveValue("Mijn eigen ontvangstscherm");
    await page.reload(); await expect(page.getByRole("textbox", { name: "Naam van je ontwerp", exact: true })).toHaveValue("Mijn eigen ontvangstscherm");
    await next(page); await expect(page.getByRole("button", { name: "Staand · 9:16", exact: true })).toHaveAttribute("aria-pressed", "true");
    const imageReferences = await page.evaluate(() => Object.values(sessionStorage).join("\n"));
    expect(imageReferences).not.toContain("http:"); expect(imageReferences).toContain("checksumSha256");
    const bounds = await page.getByLabel("Voorbeeld van je ontwerp").locator(".vc-slide-preview").boundingBox();
    expect(bounds!.height / bounds!.width).toBeCloseTo(16 / 9, 2);
    const galleryScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    const decodedGallery = [];
    for (const scene of syncBackgroundScenes) {
      const thumbnail = page.getByRole("button", { name: scene.label, exact: true }).locator("img");
      await expect(thumbnail).toHaveCount(1);
      await thumbnail.scrollIntoViewIfNeeded();
      const decoded = await thumbnail.evaluate(async element => {
        const image = element as HTMLImageElement;
        await image.decode();
        return { path: new URL(image.currentSrc).pathname, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight };
      });
      expect(decoded.width, scene.label).toBeGreaterThan(0);
      expect(decoded).toEqual({ path: scene.portrait.path, complete: true, width: scene.portrait.width, height: scene.portrait.height });
      decodedGallery.push({ scene: scene.id, ...decoded });
    }
    await page.evaluate(async position => {
      scrollTo(position.x, position.y);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, galleryScroll);
    await info.attach("actual-gallery-decode", { body: Buffer.from(JSON.stringify(decodedGallery)), contentType: "application/json" });
    await info.attach("actual-design-step", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await next(page); expect(state.creates).toEqual([]);
    await expect(page.getByText("Duur", { exact: true }).locator("..").locator("dd")).toHaveText("5 seconden per pagina · 1 pagina");
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
  expect(syncDynamicConfigurationSchema.parse(original.command.request.configuration.syncConfiguration).seed.news).toEqual([]);
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


for (const mode of ["manual", "connected"] as const) for (const scene of syncBackgroundScenes) test(`${mode} wizard persists ${scene.label} and replays the exact selected orientation`, async ({ page }) => {
  await page.route(`${origin}/onzetrots/website-brush/*`, route => {
    const path = new URL(route.request().url()).pathname, asset = syncBackgroundScenes.flatMap(value => [value.landscape, value.portrait]).find(value => value.path === path);
    return asset ? route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", asset.path)), contentType: asset.mimeType }) : route.abort();
  });
  const run = await mount(page, fixture("menu", mode === "connected"), { dropFirst: true });
  if (mode === "connected") await page.getByRole("combobox", { name: "Gekoppelde bron", exact: true }).selectOption(id(3));
  await next(page); await next(page);
  const picker = page.getByRole("group", { name: "Achtergrond", exact: true });
  await expect(picker.getByRole("button")).toHaveCount(8);
  await picker.getByRole("button", { name: scene.label, exact: true }).click();
  await page.getByRole("button", { name: "Staand · 9:16", exact: true }).click();
  await expect(page.getByLabel("Voorbeeld van je ontwerp").locator(".vc-slide-preview")).toHaveCSS("background-image", new RegExp(scene.portrait.path.replaceAll(".", "\\.")));
  await page.reload(); await expect(page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: scene.label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await next(page);
  if (mode === "connected") await page.getByRole("button", { name: "Bron controleren", exact: true }).click();
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true })).toBeEnabled();
  const original = run.creates[0]!.input, presentation = original.kind === "manual" ? original.document.syncPresentation! : (original.command.request as { configuration: { syncConfiguration: { seed: unknown } } }).configuration.syncConfiguration.seed;
  expect(presentation).toMatchObject({ orientation: "portrait", style: { background: "photo", backgroundAsset: { kind: "system", path: scene.portrait.path, checksumSha256: scene.portrait.sha256 } } });
  await page.reload(); await page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true }).click();
  await expect.poll(() => run.creates.length).toBe(2); expect(run.creates[1]).toEqual(run.creates[0]); expect(run.receipts.size).toBe(1); expect(run.errors).toEqual([]);
});
