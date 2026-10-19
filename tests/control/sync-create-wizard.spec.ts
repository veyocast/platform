import { syncBackgroundScenes } from "@veyocast/contracts";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createSyncStudioStarter } from "../../packages/studio/src/sync";
import type { SyncCreateWizardCommand, SyncCreateWizardData } from "../../apps/control/app/(shell)/dashboard/studio/sync-create-wizard-types";
import { syncConnectedAuthoringType } from "../../apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding";

// Real four-step UI, Source renderer/CSS, fields and provider-selection controls.
// Only action/navigation transport is controlled; no live publication claim.
const origin = "http://127.0.0.1:3387";
const id = (n: number) => `23400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const require = createRequire(join(process.cwd(), "package.json"));
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SyncCreateWizard}from'./apps/control/app/(shell)/dashboard/studio/sync-create-wizard';function App(){const[data,setData]=useState(globalThis.fixture);globalThis.changeWizardData=setData;return <div className="sync-control app-shell" style={{display:'block',padding:'20px'}}><main id="control-content"><SyncCreateWizard data={data}/></main></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const actions = `async function request(path,input,scope){const r=await fetch('/__wizard/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,scope})});if(!r.ok)throw Error('Transport unavailable');return r.json()}export const createSyncDesignWizardAction=(v,s)=>request('create',v,s);export const loadSyncWizardSportlinkOptionsAction=(v,s)=>request('options',v,s);export const previewSyncWizardAction=(v,s)=>request('preview',v,s);export const readSyncEngageChoicesAction=v=>request('engage-choices',v);export const readSyncEngageSelectionAction=v=>request('engage-selection',v);export const readSyncYouTubeChoicesAction=v=>request('youtube-choices',v);`;
  const link = 'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}';
  const script = `const result=await require(${JSON.stringify(require.resolve("esbuild", { paths: [require.resolve("tsx")] }))}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transport',setup(b){b.onResolve({filter:/(sync-create-wizard-actions|sync-engage-actions|sync-youtube-actions)$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:${JSON.stringify(actions)},loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({resolveDir:process.cwd(),contents:${JSON.stringify(link)},loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)}}}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

function fixture(family: SyncCreateWizardData["family"] = "welcome", connected = false): SyncCreateWizardData {
  return { tenantId: id(1), actorScope: `${id(1)}:${id(2)}`, tenantName: "Eigen club", family,
    initialPresentation: createSyncStudioStarter({ family, tenantName: "Eigen club", theme: "onzetrots-tv" }).syncPresentation!,
    canCreateManual: true, canCreateConnected: Boolean(syncConnectedAuthoringType(family)), initialMode: connected ? "connected" : "manual", slideType: syncConnectedAuthoringType(family) ?? null,
    sources: [{ id: id(3), name: "Eigen verenigingsbron", kind: "sportlink", providerStatus: "healthy", lastSuccessfulSyncAt: null, lastErrorCode: null }],
    templates: [{ versionId: id(4), orientation: "landscape", slug: "own" }, { versionId: id(5), orientation: "portrait", slug: "own-portrait" }],
    images: [{ id: id(20), title: "Eigen foto", checksumSha256: "a".repeat(64), url: `${origin}/assets/clubmuur-wall.webp` }], loadError: null,
  };
}
type Sent = { input: SyncCreateWizardCommand; scope: string };
async function mount(page: Page, data = fixture(), opts: { dropFirst?: boolean; previewDenied?: boolean; delayedCreate?: boolean; rejectReplayOnce?: boolean } = {}) {
  const creates: Sent[] = [], previews: unknown[] = [], reads: string[] = [], errors: string[] = [];
  const receipts = new Map<string, string>();
  let finishCreate: (() => Promise<void>) | null = null;
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => void dialog.accept());
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    try { return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" }); }
    catch { return route.abort(); }
  });
  await page.route(`${origin}/__wizard/*`, async route => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1)!, body = route.request().postDataJSON();
    if (path === "fixture") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nieuw ontwerp · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data)};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
    reads.push(path);
    if (path === "create") {
      creates.push(body);
      const nonce = body.input.kind === "manual" ? body.input.idempotencyKey : body.input.command.idempotencyKey;
      if (!receipts.has(nonce)) receipts.set(nonce, id(8));
      if (opts.dropFirst && creates.length === 1) return route.abort();
      if (opts.rejectReplayOnce && creates.length === 2) return route.fulfill({ json: { ok: false, rejected: true, error: "Je vereniging is tijdelijk gepauzeerd. Je invoer blijft behouden; probeer opnieuw wanneer je toegang is hersteld." } });
      const answer = () => route.fulfill({ json: { ok: true, href: `/dashboard/${body.input.kind === "manual" ? "studio" : "slides"}/${receipts.get(nonce)}` } });
      if (opts.delayedCreate) { finishCreate = answer; return; }
      return answer();
    }
    if (path === "options") return route.fulfill({ json: { ok: true, options: { sourceId: id(3), teams: [{ externalId: "own-team", name: "Eigen eerste team", contexts: [{ label: "Eigen competitie", competitionId: "comp", phaseId: "phase", poolId: "pool", seasonId: "season" }] }], capabilities: [], privacyPeople: true, privacyBirthdays: true } } });
    if (path === "preview") {
      previews.push(body);
      if (opts.previewDenied) return route.fulfill({ json: { ok: false, error: "De bronrechten zijn niet bevestigd. Je ontwerp blijft behouden; controleer Bronnen." } });
      return route.fulfill({ json: { ok: true, presentation: { ...body.input.configuration.syncConfiguration.seed, rows: [["1", "Eigen team", "4", "12"]] }, assets: {}, source: { providerStatus: "healthy", lastSuccessfulSyncAt: null, lastErrorCode: null } } });
    }
    if (path === "engage-choices") return route.fulfill({ json: { ok: true, choices: [{ id: id(31), title: "Eigen publieksvraag", status: "live" }], hasMore: false } });
    if (path === "engage-selection") return route.fulfill({ json: { ok: true, poll: { id: id(31), title: "Welke clubactiviteit kies jij?", status: "live", visibility: "live", options: [{ id: id(32), label: "Training", votes: 0 }, { id: id(33), label: "Toernooi", votes: 0 }], publicUrl: "https://example.org/poll/public-campaign" } } });
    if (path === "youtube-choices") return route.fulfill({ json: { ok: true, choices: [{ id: id(30), title: "Eigen gecontroleerde video", url: "https://www.youtube.com/watch?v=abcdefghijk" }], hasMore: false } });
    return route.abort();
  });
  await page.goto(`${origin}/__wizard/fixture`);
  await expect(page.getByRole("heading", { name: "Bron", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verder", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  return { creates, previews, reads, errors, receipts, finish: () => finishCreate?.() };
}
async function next(page: Page) { await page.getByRole("button", { name: "Verder", exact: true }).click(); }
async function toReview(page: Page) { await next(page); await next(page); await next(page); await expect(page.getByRole("heading", { name: "Controleren", exact: true })).toBeVisible(); }

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
