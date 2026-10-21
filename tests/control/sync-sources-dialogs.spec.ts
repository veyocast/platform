import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Real Source overview, modal chrome and existing provider controllers. Only
// Next transport/provider actions are controlled; this is not a live sync proof.
const origin = "http://127.0.0.1:3388";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{DialogPortalProvider}from'./packages/ui/src/components/dialog';
import{SourcesOverview}from'./apps/control/app/(shell)/dashboard/sources/sites-sources-overview';
import{SyncSourceDialogs}from'./apps/control/app/(shell)/dashboard/sources/sync-source-dialogs';
import{parseSourceSelection}from'./apps/control/app/(shell)/dashboard/sources/sites-sources-model';
import{SitesSportlinkConnectionWizard}from'./apps/control/app/(shell)/dashboard/data-sources/sportlink/sites-sportlink-connection-wizard';
import{SitesLedConnectionWizard}from'./apps/control/app/(shell)/dashboard/data-sources/led-scores/sites-led-connection-wizard';
import{SitesYouTubeWorkspace}from'./apps/control/app/(shell)/dashboard/integrations/youtube/sites-youtube-workspace';
const id=n=>'23400000-0000-4000-8000-'+String(n).padStart(12,'0');const health={label:'Opgeslagen bronstatus',tone:'neutral'};const names={sportlink:'Eigen vereniging',rss:'Eigen clubnieuws',twelve:'Eigen kantinecatalogus',led:'Eigen hoofdveld',youtube:'Eigen clubvideo'};
function App(){const[portal,setPortal]=useState(null),[selection,setSelection]=useState(null),[revision,setRevision]=useState(3);globalThis.refreshSourceRevision=()=>setRevision(4);globalThis.navigate=href=>setSelection(parseSourceSelection(Object.fromEntries(new URL(href,location.origin).searchParams)));const viewer=new URLSearchParams(location.search).has('viewer');const detail=selection?.mode==='detail'?{id:selection.id,provider:selection.provider,name:names[selection.provider],health:new URLSearchParams(location.search).has('failed')&&selection.provider==='rss'?{label:'Laatste sync mislukt',tone:'critical'}:health,lastSuccessAt:null,lastAttemptAt:null,itemCount:null,fields:[{label:'Bronnaam',value:names[selection.provider]}],items:[{id:id(9),title:'Eerder opgeslagen eigen gegevens',detail:'Geen gesimuleerde providerstatus.'}],truncated:false}:null;
const data={failed:false,cards:[],sources:[{id:id(2),name:names.rss,kind:'rss',status:'active',provider_status:'ready',last_successful_sync_at:null,last_error_code:null,refreshMinutes:5},{id:id(3),name:names.twelve,kind:'manual_products',status:'active',provider_status:'ready',last_successful_sync_at:null,last_error_code:null,refreshMinutes:null}],resources:['sportlink','led','youtube'].map((provider,i)=>({id:id(i+4),name:names[provider],provider,health,lastSuccessAt:null}))};
let controls=<label>Herkenbare naam<input aria-label="Herkenbare naam" defaultValue={detail?.name??''}/></label>;
if(selection?.provider==='sportlink')controls=<SitesSportlinkConnectionWizard inline canManage={!viewer} birthdaysAvailable initial={detail?{id:detail.id,clubName:'Eigen vereniging',revision,teamCodes:['own-team'],birthdaysEnabled:false}:null}/>;
if(selection?.provider==='led')controls=<SitesLedConnectionWizard inline canManage={!viewer} clubs={[]} teams={[]} initial={detail?{connectionId:detail.id,expectedRevision:revision,name:'Eigen hoofdveld',clubSlug:'eigen-club',scoreboardLabel:'Hoofdveld',sportsClubId:null,status:'active',mappings:[{teamKey:'own',teamName:'Eigen team',side:'own',sportsTeamId:null},{teamKey:'other',teamName:'Tegenstander',side:'opponent',sportsTeamId:null}]}:undefined}/>;
if(selection?.provider==='youtube')controls=<SitesYouTubeWorkspace inline sourceId={detail?.id} canManage={!viewer} configured assets={[{id:id(12),title:'Eigen back-up',kind:'image'}]} sources={detail?[{id:detail.id,revision,title:'Eigen clubvideo',video_id:'abcdefghijk',playlist_id:null,playlist_video_ids:null,playlist_unavailable_count:0,playlist_repeat:false,fallback_media_asset_id:id(12),channel_title:null,validation_status:'verified',embeddable:true,status:'active'}]:[]}/>;
return <div ref={setPortal} className="sync-control app-shell" style={{display:'block',padding:24}}><DialogPortalProvider container={portal}><SourcesOverview data={data} canManage={!viewer} canDesign={!viewer} canReadProducts={!viewer}/><SyncSourceDialogs key={selection?JSON.stringify(selection):'closed'} selection={selection} detail={detail} canManage={!viewer} canReadProducts={!viewer} timezoneName="Europe/Amsterdam" createContent={controls} settingsContent={controls}/></DialogPortalProvider></div>}
createRoot(document.getElementById('root')).render(<App/>);`;
  const actions = `function record(kind,value){globalThis.commands=(globalThis.commands||[]).concat({kind,value:structuredClone(value)});const attempt=globalThis.commands.filter(x=>x.kind===kind).length;if(attempt===2)return{ok:false,code:kind==='led'?'SOURCE_PERMISSION_REQUIRED':'SOURCE_CONFIGURATION_UNAVAILABLE'};globalThis.receipts=globalThis.receipts||[];const request=JSON.stringify(value),receipt=globalThis.receipts.find(x=>x.kind===kind&&x.idempotencyKey===value.idempotencyKey);if(receipt&&receipt.request!==request)return{ok:false,code:'SOURCE_INPUT_INVALID'};if(!receipt)globalThis.receipts.push({kind,idempotencyKey:value.idempotencyKey,request});return attempt===1?{ok:false,code:'SOURCE_SAVE_UNCONFIRMED'}:{ok:true}}export async function validateSitesSportlinkConnection(value){globalThis.validations=(globalThis.validations||[]).concat(value);return{ok:true,validationId:'23400000-0000-4000-8000-000000000020',clubName:'Eigen vereniging',clientSuffix:'1234',teams:[{code:'own-team',name:'Eigen team'}]}}export async function saveSitesSportlinkConnection(value){return record('sportlink',value)}export async function saveSitesLedConnection(value){return record('led',value)}export async function validateYouTubeSelection(value){globalThis.validations=(globalThis.validations||[]).concat(value);return{ok:true,validationId:'23400000-0000-4000-8000-000000000021',kind:'video',title:value.name,providerTitle:'Gecontroleerde eigen selectie',channelTitle:'Eigen kanaal',videoCount:1,unavailableItems:0,providerItemCount:1}}export async function saveSitesYouTubeSource(value){return record('youtube',value)}export async function manageYouTubeSource(){throw Error('No management write expected in this test')}`;
  const code = `const r=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},external:['/onzetrots-tv/*'],plugins:[{name:'controlled-next-transport',setup(b){b.onResolve({filter:/^next\\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?'export const useRouter=()=>({replace:href=>globalThis.navigate(href),push:href=>globalThis.navigate(href),refresh(){}});':a.path.endsWith('image')?'import React from"react";export default function Image({unoptimized,fill,...props}){return React.createElement("img",props)}':'import React from"react";export default function Link({scroll,onClick,...props}){return React.createElement("a",{...props,onClick:event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();globalThis.navigate(props.href)}}})}',resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/(?:actions|action)$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:${JSON.stringify(actions)},loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:r.outputFiles.find(f=>f.path.endsWith('.js')).text,css:r.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, viewer = false) {
  const errors: string[] = [], unexpected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/onzetrots-tv/assets/")) {
      const name = url.pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      try { return route.fulfill({ body: readFileSync(join(process.cwd(), url.pathname.startsWith("/onzetrots-tv/") ? "apps/control/public/onzetrots-tv/assets" : "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : name.endsWith("webp") ? "image/webp" : "image/svg+xml" }); } catch { return route.fulfill({ status: 404 }); }
    }
    if (url.pathname !== "/__sources") { unexpected.push(url.pathname); return route.abort(); }
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bronnen · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(`${origin}/__sources${viewer ? "?viewer=1" : ""}`);
  return { errors, unexpected };
}
async function calls(page: Page) {
  return page.evaluate(() => ({ validations: (globalThis as typeof globalThis & { validations?: unknown[] }).validations ?? [], commands: (globalThis as typeof globalThis & { commands?: unknown[] }).commands ?? [] }));
}

// Published generic EasyList cosmetic rules. These match ordinary management
// controls in the old overview, not advertising. Keep the rules active after
// the fix; changing browser preferences must not be required to read sources.
// https://github.com/easylist/easylist/blob/master/easylist/easylist_general_hide.txt
async function applyCosmeticSourceFilters(page: Page) {
  await page.addStyleTag({ content: ".ad-source, .ad-tabs, .ad-notice { display: none !important; }" });
  await page.evaluate(() => {
    const checks = document.createElement("div");
    checks.setAttribute("aria-hidden", "true");
    checks.dataset.cosmeticFilterChecks = "true";
    for (const className of ["ad-source", "ad-tabs", "ad-notice"]) {
      const check = document.createElement("span");
      check.className = className;
      check.textContent = "Filtercontrole";
      checks.append(check);
    }
    document.body.append(checks);
  });
  for (const check of await page.locator("[data-cosmetic-filter-checks] > span").all()) await expect(check).toBeHidden();
}

for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  test(`source status and keyboard remain visible with cosmetic ad filters at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const fixture = await mount(page);
    await page.evaluate(() => document.fonts.ready);
    const source = page.getByRole("link", { name: /Eigen vereniging/ });
    const filters = page.locator('[aria-label="Bronsoort"]');
    const notice = page.getByText("Gegevens verversen binnen je gepubliceerde selectie.", { exact: false });
    await expect(source).toBeVisible(); await expect(filters).toBeVisible(); await expect(notice).toBeVisible();
    const before = { source: await source.boundingBox(), filters: await filters.boundingBox(), notice: await notice.boundingBox() };
    await info.attach("source-geometry-without-filters", { body: JSON.stringify(before), contentType: "application/json" });
    await info.attach("sources-before-filters", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await applyCosmeticSourceFilters(page);
    await info.attach("sources-with-filters", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await expect(source).toBeVisible();
    await expect(source.getByText("Opgeslagen bronstatus", { exact: true })).toBeVisible();
    await expect(filters).toBeVisible(); await expect(notice).toBeVisible();
    expect({ source: await source.boundingBox(), filters: await filters.boundingBox(), notice: await notice.boundingBox() }).toEqual(before);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    const sportlink = page.getByRole("button", { name: "Sportlink", exact: true });
    await sportlink.focus(); await page.keyboard.press("Space");
    await expect(page.locator(".ad-source-grid > a")).toHaveCount(1);
    await source.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Eigen vereniging", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: "Overzicht", exact: true }).focus(); await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("tab", { name: "Gegevens", exact: true })).toBeFocused();
    await expect(dialog.getByText("Eerder opgeslagen eigen gegevens", { exact: true })).toBeVisible();
    expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]); expect(await calls(page)).toEqual({ validations: [], commands: [] });
  });
}

for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  test(`Source create540/detail960, real cards, tabs and a11y at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); const fixture = await mount(page);
    await expect(page.locator(".ad-source-grid > a")).toHaveCount(5);
    await expect(page.locator('[aria-label="Bronsoort"] > button')).toHaveCount(6);
    for (const filter of await page.locator('[aria-label="Bronsoort"] > button').all()) expect((await filter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("link", { name: "Bron toevoegen", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Een bron verbinden" });
    await expect(dialog.getByLabel("Naam vereniging", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Een bron verbinden", exact: true })).toHaveCSS("font-size", viewport.width === 390 ? "24px" : "26px");
    await expect(dialog.getByRole("combobox", { name: "Bronsoort", exact: true })).toHaveAccessibleName("Bronsoort");
    await dialog.getByRole("combobox", { name: "Bronsoort", exact: true }).selectOption("rss");
    await expect(dialog.getByLabel("Herkenbare naam")).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())!.width).toBeCloseTo(viewport.width === 390 ? 370 : 540, 0);
    for (const provider of ["twelve", "led", "youtube", "sportlink"]) await dialog.getByRole("combobox", { name: "Bronsoort", exact: true }).selectOption(provider);
    expect(await calls(page)).toEqual({ validations: [], commands: [] });
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await page.locator(".ad-source-grid > a").filter({ hasText: "Eigen vereniging" }).click();
    const detail = page.getByRole("dialog", { name: "Eigen vereniging", exact: true });
    await expect.poll(async () => (await detail.boundingBox())!.width).toBeCloseTo(viewport.width === 390 ? 370 : 960, 0);
    await expect(detail.getByRole("tab")).toHaveCount(3);
    await detail.getByRole("tab", { name: "Overzicht", exact: true }).focus();
    await page.keyboard.press("ArrowRight"); await expect(detail.getByRole("tab", { name: "Gegevens", exact: true })).toBeFocused();
    await expect(detail.getByText("Eerder opgeslagen eigen gegevens", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowLeft"); await expect(detail.getByRole("tab", { name: "Overzicht", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight"); await expect(detail.getByRole("tab", { name: "Gegevens", exact: true })).toBeFocused();
    await page.keyboard.press("End"); await expect(detail.getByRole("tab", { name: "Instellingen", exact: true })).toBeFocused();
    const client = detail.getByLabel("Sportlink Client ID", { exact: true }); await client.fill("retained-local-input");
    await detail.getByRole("tab", { name: "Overzicht", exact: true }).click(); await detail.getByRole("tab", { name: "Instellingen", exact: true }).click(); await expect(client).toHaveValue("retained-local-input");
    await detail.evaluate(element => element.setAttribute("dir", "rtl"));
    await detail.getByRole("tab", { name: "Overzicht", exact: true }).focus(); await page.keyboard.press("ArrowLeft"); await expect(detail.getByRole("tab", { name: "Gegevens", exact: true })).toBeFocused();
    await detail.evaluate(element => element.removeAttribute("dir")); await detail.getByRole("tab", { name: "Instellingen", exact: true }).click();
    for (const button of await detail.getByRole("button").all()) { if (await button.isVisible()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach("actual-source-dialogs", { body: await page.screenshot(), contentType: "image/png" });
    expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]); expect(await calls(page)).toEqual({ validations: [], commands: [] });
  });
}

async function receipts(page: Page) {
  return page.evaluate(() => (globalThis as typeof globalThis & { receipts?: Array<{ kind: string; idempotencyKey: string; request: string }> }).receipts ?? []);
}

for (const provider of ["sportlink", "led", "youtube"] as const) {
  test(`existing ${provider} command retains exact body/nonce through committed UNKNOWN, temporary rejection and receipt recovery`, async ({ page }) => {
    const fixture = await mount(page);
    await page.locator(".ad-source-grid > a").filter({ hasText: provider === "sportlink" ? "Eigen vereniging" : provider === "led" ? "Eigen hoofdveld" : "Eigen clubvideo" }).click();
    const dialog = page.getByRole("dialog"); await dialog.getByRole("tab", { name: "Instellingen", exact: true }).click();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    if (provider === "sportlink") { await dialog.getByLabel("Sportlink Client ID").fill("own-client-1234"); await dialog.getByRole("button", { name: "Verbinding controleren", exact: true }).click(); await dialog.getByRole("button", { name: "Controleren", exact: true }).click(); await dialog.getByRole("button", { name: "Koppeling opslaan", exact: true }).click(); }
    else if (provider === "led") { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByRole("button", { name: "Verbinding opslaan", exact: true }).click(); }
    else { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByRole("button", { name: "Bron opslaan", exact: true }).click(); }
    const retry = dialog.getByRole("button", { name: "Dezelfde opslag opnieuw proberen", exact: true }); await expect(retry).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeDisabled();
    const before = await calls(page); expect(before.commands).toHaveLength(1);
    // This controlled ledger models one committed receipt whose first response
    // was lost. The second rejection occurs before that ledger is consulted.
    const committed = await receipts(page); expect(committed).toHaveLength(1);
    expect(committed[0]!.request).toBe(JSON.stringify((before.commands[0] as { value: unknown }).value));
    await page.evaluate(() => (globalThis as typeof globalThis & { refreshSourceRevision?: () => void }).refreshSourceRevision?.());
    await dialog.getByRole("tab", { name: "Overzicht", exact: true }).click(); await dialog.getByRole("tab", { name: "Gegevens", exact: true }).click(); await dialog.getByRole("tab", { name: "Instellingen", exact: true }).click();
    await retry.click(); await expect.poll(async () => (await calls(page)).commands.length).toBe(2);
    await expect(retry).toBeVisible(); await expect(retry).toBeEnabled();
    await expect(dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeDisabled();
    const rejected = await calls(page); expect(rejected.commands[1]).toEqual(rejected.commands[0]);
    expect(rejected.validations).toEqual(before.validations); expect(await receipts(page)).toEqual(committed);
    await dialog.getByRole("tab", { name: "Overzicht", exact: true }).click(); await dialog.getByRole("tab", { name: "Gegevens", exact: true }).click(); await dialog.getByRole("tab", { name: "Instellingen", exact: true }).click();
    await retry.click(); await expect.poll(async () => (await calls(page)).commands.length).toBe(3);
    const after = await calls(page); expect(after.commands[1]).toEqual(after.commands[0]); expect(after.commands[2]).toEqual(after.commands[0]);
    expect((after.commands[0] as { value: { idempotencyKey: string } }).value.idempotencyKey).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
    expect(after.validations).toEqual(before.validations); expect(await receipts(page)).toEqual(committed); await expect(dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeEnabled();
    expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
  });
}

test("read-only role has genuine source cards without create/provider or fabricated recovery controls", async ({ page }) => {
  const fixture = await mount(page, true);
  await applyCosmeticSourceFilters(page);
  await expect(page.getByRole("link", { name: "Bron toevoegen", exact: true })).toHaveCount(0);
  await expect(page.locator(".ad-source-grid > a")).toHaveCount(4);
  await page.locator(".ad-source-grid > a").filter({ hasText: "Eigen vereniging" }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByRole("tab", { name: "Instellingen", exact: true }).click();
  await expect(dialog.getByLabel("Sportlink Client ID")).toBeDisabled();
  await expect(page.getByText("Bronstatus testen", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lege feed", exact: true })).toHaveCount(0);
  expect(await calls(page)).toEqual({ validations: [], commands: [] }); expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});

// A failed provider must keep saved content readable without a healthy overview claim.
test("failed RSS overview warns and retains saved data without starting a provider command", async ({ page }) => {
  const fixture = await mount(page);
  const failedUrl = new URL(page.url()); failedUrl.searchParams.set("failed", "1");
  await page.goto(failedUrl.href);
  await applyCosmeticSourceFilters(page);
  await page.locator(".ad-source-grid > a").filter({ hasText: "Eigen clubnieuws" }).click();
  const detail = page.getByRole("dialog", { name: "Eigen clubnieuws", exact: true });
  await expect(detail.getByRole("alert")).toContainText("De laatste synchronisatie is mislukt");
  await expect(detail.getByRole("alert")).toContainText("opgeslagen gegevens blijven bewaard");
  await expect(detail.getByRole("alert")).toContainText("synchroniseren opnieuw");
  await detail.getByRole("tab", { name: "Gegevens", exact: true }).click();
  await expect(detail.getByText("Eerder opgeslagen eigen gegevens", { exact: true })).toBeVisible();
  expect(await calls(page)).toEqual({ validations: [], commands: [] });
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});
