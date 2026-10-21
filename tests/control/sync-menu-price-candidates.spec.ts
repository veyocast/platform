import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Real workspace/editor/portal components and production CSS. Only Next and the
// action/read-model transport are controlled; this is not Auth/RLS acceptance.
const origin = "http://127.0.0.1:3345";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const id = (n: number) => `a2610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = `${id(1)}:${id(2)}`;
const storageKey = `veyocast:menu-prices:v1:${scope}`;
const sharedRoot = resolve(process.env.S261_SHARED_ROOT ?? process.cwd());
const productsPath = "apps/control/app/(shell)/dashboard/integrations/twelve-products/";
const cssPaths = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css"];
let compiled: { js: string; css: string };

function compileFixture() {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'@veyocast/ui';import{createSyncStudioStarter}from'@veyocast/studio';import{SitesProductsWorkspace}from'./${productsPath}sites-products-workspace';import{SyncDynamicEditor}from'./apps/control/app/(shell)/dashboard/slides/sync-dynamic-editor';
const id=n=>'a2610000-0000-4000-8000-'+String(n).padStart(12,'0');const seed=createSyncStudioStarter({family:'menu',tenantName:'Eigen vereniging',theme:'fieldflow'}).syncPresentation;
window.__s261Seed={...seed,rows:[]};
function Fixture(){const[container,setContainer]=useState(null),source=new URL(location.href).searchParams.get('surface')==='source',cfg={syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'menu',seed:{...seed,rows:[]},secondsPerPage:3},menuPriceSet:{dataSourceId:id(10),hash:'a'.repeat(64)}};
return <div ref={setContainer} className='sites-control vx-shell app-shell design-sync sync-control' style={{gridTemplateColumns:'minmax(0,1fr)'}}><DialogPortalProvider container={container}><main className='vx-main app-body'><div id='control-content' className='vx-content main-content'>{source?<SyncDynamicEditor tenantId={id(1)} slideId={id(3)} versionId={id(4)} initialRevision={4} initialRequest={{templateVersionId:id(9),dataSourceId:id(10),configuration:cfg}} sources={[{id:id(10),name:'Eerste bron',kind:'manual_products',provider_status:'ready',last_successful_sync_at:null,last_error_code:null},{id:id(11),name:'Nieuwe bron',kind:'manual_products',provider_status:'ready',last_successful_sync_at:null,last_error_code:null}]} templates={[{current_published_version_id:id(9),orientation:'landscape',slug:'own-menu'}]} assets={[]} error={null}/>:<><h1>Producten</h1><SitesProductsWorkspace catalog={{products:[],count:75,total:75,active:75,categories:[],categoriesComplete:true,offset:0,pageSize:50}} canRead canWrite canUploadLogo={false} manualSources={[]} priceActorScope={id(1)+':'+id(2)} initialPriceImpact={window.__s261InitialImpact} canPreparePrices canPublishPrices/></>}</div></main></DialogPortalProvider></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`;
  const code = String.raw`(async()=>{const e=require(${JSON.stringify(compiler)});const transport='async function call(name,input){const response=await fetch("/__s261-transport",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,input})});if(!response.ok)throw Error("Controlled lost response");return response.json()}';
const result=await e.build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'css','.module.css':'local-css','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl','.svg':'dataurl','.png':'dataurl','.webp':'dataurl'},plugins:[{name:'next-and-action-transport',setup(b){
b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>location.assign(path),replace:path=>location.assign(path),refresh(){}})':'import React from"react";export default function View({children,priority,unoptimized,fill,...props}){return React.createElement('+JSON.stringify(a.path.endsWith('image')?'img':'a')+',props,children)}',loader:'js',resolveDir:process.cwd()}));
b.onResolve({filter:/menu-price-actions$|sync-dynamic-actions$/},a=>({path:a.path,namespace:'transport'}));b.onLoad({filter:/.*/,namespace:'transport'},a=>({contents:transport+(a.path.endsWith('menu-price-actions')?['readMenuPriceImpactAction','readMenuPriceCandidatesAction','prepareMenuPriceCandidatesAction','publishMenuPriceCandidatesAction']:['mutateSyncDynamicAuthoringAction','previewSyncDynamicAuthoringAction','loadSyncDynamicBindingOptionsAction']).map(name=>'export const '+name+'=input=>call('+JSON.stringify(name)+',input);').join(''),loader:'js'}));
b.onResolve({filter:/^\.\/actions$/},a=>a.importer.includes('/twelve-products/')?({path:a.path,namespace:'catalog'}):null);b.onLoad({filter:/.*/,namespace:'catalog'},()=>({contents:transport+['listProductsPage','manageProduct','setProductAvailability'].map(name=>'export const '+name+'=input=>call('+JSON.stringify(name)+',input);').join(''),loader:'js'}));
${process.env.S261_ORIGINAL_UI === "1" ? `b.onLoad({filter:/sites-products-workspace[.]tsx$|sites-products[.]module[.]css$/},a=>({contents:require('node:child_process').execFileSync('git',['show','f740e96820d82d047e6d1a4c0ab05f565f99b2ed:'+require('node:path').relative(process.cwd(),a.path)],{encoding:'utf8'}),loader:a.path.endsWith('.tsx')?'tsx':'local-css',resolveDir:require('node:path').dirname(a.path)}));` : ""}
}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''}));})().catch(error=>{console.error(error);process.exitCode=1});`;
  compiled = JSON.parse(execFileSync(process.execPath, ["-e", code], { encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }));
}
if (process.env.S261_COMPILE_ONLY === "1") {
  compileFixture();
  process.stdout.write(JSON.stringify({ status: "FIXTURE_COMPILED_ONLY_NO_BROWSER", jsBytes: Buffer.byteLength(compiled.js), cssBytes: Buffer.byteLength(compiled.css) }) + "\n");
} else test.beforeAll(compileFixture);

const impact = (hash: string, offset = 0) => ({ ok: true, data: {
  status: "ready", complete: true, reviewHash: hash.repeat(64), totalProducts: 75, changedProducts: 21, affectedMenus: 2, affectedPlacements: 3, affectedPlaylists: 1, desiredScreens: 2, confirmedScreens: 1, unknownScreens: 1, reviewRequiredProducts: 0, offset, limit: 20, hasMore: offset === 0,
  rows: Array.from({ length: offset ? 1 : 20 }, (_, i) => ({ productId: id(100 + offset + i), name: offset ? "Product buiten de cataloguspagina" : `Eigen product ${i + 1}`, previousCatalogPrices: [250, 275], previousDisplayPrices: [250, 275], nextCatalogPrice: 350, overridePrices: i === 0 ? [250] : [], affectedMenus: 2, unpriced: false })),
  menus: [3, 5].map((n, i) => ({ slideId: id(n), basisVersionId: id(n + 20), expectedRevision: 4, sourceId: id(10), name: ["Kantinemenu", "Tweede menu"][i], editor: "sync", changedProducts: 21, preservedOverrides: 1, unpricedProducts: 0, canPrepare: true, blockedReason: null, playlists: [{ id: id(8), name: "Eigen clubprogramma" }] })), error: null,
} });

async function record(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}
async function widths(page: Page, info: TestInfo, phase: string) {
  const diagnostic = await page.evaluate(() => {
    const rect = (element: Element) => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width }; };
    const identity = (element: Element | null) => element ? { tag: element.tagName, id: element.id, className: element.getAttribute("class") } : null;
    const main = document.querySelector(".vx-main")!;
    const bounds = main.getBoundingClientRect();
    return {
      containers: [...document.querySelectorAll(".vx-main,.vx-content")].map(element => ({ ...identity(element), client: element.clientWidth, scroll: element.scrollWidth, rect: rect(element) })),
      catalogueLabels: [...document.querySelectorAll(".sync-products .sync-sr-only")].map(element => ({ ...identity(element), rect: rect(element), position: getComputedStyle(element).position, offsetParent: identity((element as HTMLElement).offsetParent) })),
      outsideMain: [...main.querySelectorAll("*")].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && (box.left < bounds.left || box.right > bounds.right); }).slice(0, 40).map(element => ({ ...identity(element), rect: rect(element), position: getComputedStyle(element).position, overflowX: getComputedStyle(element).overflowX, offsetParent: identity((element as HTMLElement).offsetParent) })),
    };
  });
  const path = info.outputPath(`${phase}-width-diagnostic.json`);
  writeFileSync(path, JSON.stringify(diagnostic, null, 2));
  await info.attach(`${phase}-width-diagnostic`, { path, contentType: "application/json" });
  expect(diagnostic.containers).toHaveLength(2);
  for (const value of diagnostic.containers) expect(value.scroll).toBeLessThanOrEqual(value.client);
}
async function completeMobilePrices(page: Page) {
  const list = page.getByRole("dialog").locator('dl[aria-label="Prijsverschillen per product"]');
  await expect(list).toBeVisible();
  const rows = list.locator(":scope > div");
  await expect(rows).toHaveCount(21);
  const expectedNames = [...Array.from({ length: 20 }, (_, index) => `Eigen product ${index + 1}`), "Product buiten de cataloguspagina"];
  for (const [index, row] of (await rows.all()).entries()) {
    await expect(row.getByRole("term")).toHaveText(["Product", "Vastgelegde prijs", "Nieuwe catalogusprijs"]);
    const values = row.getByRole("definition");
    await expect(values.nth(0)).toContainText(expectedNames[index]);
    await expect(values.nth(1)).toContainText("€ 2,50");
    await expect(values.nth(1)).toContainText("€ 2,75");
    await expect(values.nth(2)).toContainText("€ 3,50");
  }
  await expect(rows.first()).toContainText("Plaatsingsprijs blijft behouden: € 2,50");
  const layout = await list.evaluate(element => {
    const body = element.closest(".vc-overlay-body")!; const bounds = body.getBoundingClientRect();
    return { client: element.clientWidth, scroll: element.scrollWidth, bodyLeft: bounds.left, bodyRight: bounds.right, cells: [...element.querySelectorAll("dt,dd")].map(cell => { const box = cell.getBoundingClientRect(); return { left: box.left, right: box.right, client: cell.clientWidth, scroll: cell.scrollWidth }; }) };
  });
  expect(layout.cells).toHaveLength(21 * 6);
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  for (const cell of layout.cells) {
    expect(cell.left).toBeGreaterThanOrEqual(layout.bodyLeft);
    expect(cell.right).toBeLessThanOrEqual(layout.bodyRight);
    expect(cell.scroll).toBeLessThanOrEqual(cell.client);
  }
}
async function hitTarget(locator: ReturnType<Page["getByRole"]>) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox(); expect(box).not.toBeNull(); expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await locator.evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
}

if (process.env.S261_COMPILE_ONLY !== "1") for (const width of [390, 1440]) {
  test(`explicit global price capture, separate publication, lost-ACK recovery and source change at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const assetReads = new Map<string, { sha256: string; bytes: number }>();
    const errors: string[] = [], requests: { name: string; input: Record<string, unknown> }[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let hash = "a", firstPrepare = true, stored: Record<string, unknown> | null = null, published = false, renderFailed = false;
    const receipt = (key: string) => ({ captureActorId: id(2), captureKey: key, candidates: [3, 5].map((n, i) => ({ slideId: id(n), versionId: id(n + 30), editRevision: 5, name: ["Kantinemenu", "Tweede menu"][i], editor: "sync", priceSetHash: "b".repeat(64), state: published && i === 0 ? renderFailed ? "failed" : "pending" : "draft", snapshotId: published && i === 0 ? id(50) : null, jobId: published && i === 0 ? id(51) : null, playlists: [{ id: id(8), name: "Eigen clubprogramma" }] })) });
    await page.route(`${origin}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === "/__s261-transport" && request.method() === "POST") {
        const body = request.postDataJSON(); requests.push(body);
        const { name, input } = body;
        let result: unknown;
        if (name === "readMenuPriceImpactAction") {
          if (input.offset && hash === "a") hash = "b";
          result = impact(hash, input.offset);
        } else if (name === "prepareMenuPriceCandidatesAction") {
          expect(input.reviewHash).toBe("b".repeat(64)); expect(input.selections.map((item: { slideId: string }) => item.slideId).sort()).toEqual([id(3), id(5)].sort());
          if (!stored) stored = structuredClone(input); else expect(input).toEqual(stored);
          if (firstPrepare) { firstPrepare = false; return route.fulfill({ status: 503, body: "Controlled lost response" }); }
          result = { ok: true, data: receipt(input.idempotencyKey) };
        } else if (name === "readMenuPriceCandidatesAction") {
          expect(input).toEqual({ captureActorId: id(2), captureKey: stored!.idempotencyKey });
          if (published) renderFailed = true;
          result = { ok: true, data: receipt(String(stored!.idempotencyKey)) };
        } else if (name === "publishMenuPriceCandidatesAction") {
          expect(input.captureKey).toBe(stored!.idempotencyKey);
          expect(input.candidates).toEqual([{ slideId: id(3), versionId: id(33), expectedRevision: 5 }]);
          expect(input.idempotencyKey).not.toBe(stored!.idempotencyKey); published = true;
          result = { ok: true, data: receipt(String(stored!.idempotencyKey)) };
        } else if (name === "previewSyncDynamicAuthoringAction") {
          const seed = input.configuration.syncConfiguration.seed;
          result = { ok: true, priceReviewHash: (input.dataSourceId === id(11) ? "c" : "a").repeat(64), presentation: { ...seed, rows: [["Eigen bronproduct", input.dataSourceId === id(11) ? "€ 5,00" : "€ 2,50", "", ""]], state: "ready" }, assets: {}, source: { providerStatus: "ready", lastSuccessfulSyncAt: null, lastErrorCode: null } };
        } else if (name === "mutateSyncDynamicAuthoringAction") {
          expect(input.action).toBe("save"); expect(input.request.dataSourceId).toBe(id(11));
          expect(input.request.configuration.menuPriceSet).toBeUndefined();
          expect(input.request.configuration.menuPriceSourceReview).toEqual({ sourceId: id(11), priceReviewHash: "c".repeat(64), confirmed: true });
          const configuration = { ...input.request.configuration, menuPriceSet: { dataSourceId: id(11), hash: "d".repeat(64) } };
          delete configuration.menuPriceSourceReview;
          result = { ok: true, slideId: id(3), editRevision: 5, configuration };
        } else throw new Error(`Unexpected controlled transport: ${name}`);
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
      }
      if (request.method() !== "GET") throw new Error(`Unexpected write ${request.method()} ${url.pathname}`);
      if (["/assets/", "/fonts/", "/onzetrots/"].some(prefix => url.pathname.startsWith(prefix))) {
        const base = resolve(sharedRoot, "apps/control/public"), path = resolve(base, `.${decodeURIComponent(url.pathname)}`);
        if (!path.startsWith(base + sep)) throw new Error("Asset path escaped the actual public tree");
        const bytes = readFileSync(path), proof = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
        const earlier = assetReads.get(path); if (earlier) expect(proof).toEqual(earlier); else assetReads.set(path, proof);
        return route.fulfill({ body: bytes, contentType: path.endsWith("woff2") ? "font/woff2" : path.endsWith("ttf") ? "font/ttf" : path.endsWith("svg") ? "image/svg+xml" : path.endsWith("png") ? "image/png" : "image/webp" });
      }
      if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body: compiled.js });
      if (url.pathname === "/__s261") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Menuprijzen controleren</title><style>${cssPaths.map(path => readFileSync(join(sharedRoot, path), "utf8").replace(/@import[^;]+;/g, "")).join("\n")}${compiled.css}</style></head><body><div id="root"></div><script>window.__s261InitialImpact=${JSON.stringify(impact("a"))}</script><script src="/fixture.js"></script></body></html>` });
      return route.abort();
    });
    await page.goto(`${origin}/__s261`);
    await page.evaluate(() => document.fonts.ready);
    await record(page, info, "products-entry");
    const trigger = page.getByRole("button", { name: "Prijzen bijwerken", exact: true });
    await expect(trigger).toBeEnabled(); await trigger.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Prijzen bijwerken", exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog.locator(".sync-control")).toHaveCount(0);
    expect(await dialog.evaluate(node => Boolean(node.closest(".sync-control")))).toBe(true);
    if (width === 390) {
      await expect(dialog.locator('dl[aria-label="Prijsverschillen per product"]')).toBeVisible();
      await expect(dialog.getByRole("table", { includeHidden: true })).toBeHidden();
    } else await expect(dialog.getByRole("table")).toBeVisible();
    await record(page, info, "price-diff-dialog-top-before-write");
    expect(requests.filter(item => item.name.startsWith("prepare") || item.name.startsWith("publish"))).toHaveLength(0);
    const choices = dialog.getByRole("group", { name: "Kies de concepten die je bijwerkt" });
    await expect(choices.getByRole("checkbox", { checked: true })).toHaveCount(0);
    await choices.getByLabel("Kantinemenu", { exact: false }).check();
    await expect(dialog.getByRole("button", { name: "Prijsversie vastleggen", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Meer prijsverschillen tonen" }).click();
    await expect(dialog.getByText("De prijzen of menu’s zijn gewijzigd.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Volledige impact opnieuw lezen" }).click();
    await expect(choices.getByRole("checkbox", { checked: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Meer prijsverschillen tonen" }).click();
    await expect((width === 390 ? dialog.locator('dl[aria-label="Prijsverschillen per product"]') : dialog.getByRole("table")).getByText("Product buiten de cataloguspagina", { exact: false })).toBeVisible();
    if (width === 390) await completeMobilePrices(page);
    for (const label of await choices.locator("label").all()) await hitTarget(label);
    for (const checkbox of await choices.getByRole("checkbox").all()) await checkbox.check();
    await choices.scrollIntoViewIfNeeded();
    await record(page, info, "price-diff-dialog-lower-before-write");
    const inner = await dialog.locator(".vc-overlay-body").evaluate(element => ({ top: element.scrollTop, client: element.clientHeight, scroll: element.scrollHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(inner.scroll).toBeGreaterThan(inner.client);
    expect(inner.top).toBeGreaterThan(0);
    expect(requests.filter(item => item.name.startsWith("prepare") || item.name.startsWith("publish"))).toHaveLength(0);
    const innerPath = info.outputPath("price-diff-inner-scroll-before-write.json");
    writeFileSync(innerPath, JSON.stringify(inner, null, 2));
    await info.attach("price-diff-inner-scroll-before-write", { path: innerPath, contentType: "application/json" });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const prepare = dialog.getByRole("button", { name: "Prijsversie vastleggen", exact: true });
    await hitTarget(prepare); await prepare.click();
    await expect(dialog.getByRole("button", { name: "Dezelfde opdracht opnieuw bevestigen" })).toBeVisible();
    const first = requests.find(item => item.name === "prepareMenuPriceCandidatesAction")!;
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).prepare, storageKey)).toEqual(first.input);
    await page.reload(); await expect(page.getByRole("button", { name: "Prijzen bijwerken", exact: true })).toBeEnabled();
    expect(requests.filter(item => item.name.includes("prepare") || item.name.includes("publish"))).toHaveLength(1);
    await page.getByRole("button", { name: "Prijzen bijwerken", exact: true }).click();
    await dialog.getByRole("button", { name: "Bestaande opdracht controleren" }).click();
    await dialog.getByRole("button", { name: "Dezelfde opdracht opnieuw bevestigen" }).click();
    await expect(dialog.getByRole("group", { name: "Kies welke kandidaten je publiceert" })).toBeVisible();
    expect(requests.filter(item => item.name === "prepareMenuPriceCandidatesAction").map(item => item.input)).toEqual([first.input, first.input]);
    const candidateChoices = dialog.getByRole("group", { name: "Kies welke kandidaten je publiceert" });
    await expect(candidateChoices.getByRole("checkbox", { checked: true })).toHaveCount(0);
    await candidateChoices.getByLabel("Kantinemenu", { exact: false }).check();
    const publish = dialog.getByRole("button", { name: "Nieuwe kandidaten publiceren", exact: true });
    await hitTarget(publish); await publish.click();
    await expect(dialog.getByText("Voorbereiding loopt", { exact: true })).toBeVisible();
    await expect(dialog.getByText("dit betekent niet dat de nieuwe prijzen al op TV actief zijn", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Eigen clubprogramma" }).first()).toHaveAttribute("href", `/dashboard/playlists/${id(8)}`);
    await expect(dialog.getByText("Nieuwste Studio-versie", { exact: true })).toBeVisible();
    expect(requests.filter(item => item.name === "publishMenuPriceCandidatesAction")).toHaveLength(1);
    await dialog.getByRole("button", { name: "Status opnieuw lezen" }).click();
    await expect(dialog.getByText("Voorbereiding mislukt", { exact: true })).toBeVisible();
    await expect(candidateChoices.getByLabel("Kantinemenu", { exact: false })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Nieuwe kandidaten publiceren", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("link", { name: "Open de versiestatus en herstel de voorbereiding" })).toHaveAttribute("href", `/dashboard/slides/${id(3)}`);
    expect(requests.filter(item => item.name === "publishMenuPriceCandidatesAction")).toHaveLength(1);
    await record(page, info, "separate-publication-receipt"); await widths(page, info, "publication-receipt");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();

    // The existing actual Source editor changes source through a fresh read and
    // explicit price confirmation; the canonical reply replaces the baseline.
    await page.goto(`${origin}/__s261?surface=source`);
    await page.getByRole("button", { name: "Gegevensbron", exact: true }).click();
    const source = page.getByLabel("Gekoppelde bron", { exact: true });
    await source.selectOption(id(11));
    const confirmed = page.getByRole("checkbox", { name: "Ik heb de nieuwe bron en prijzen gecontroleerd" });
    await expect(confirmed).toBeEnabled(); await expect(confirmed).not.toBeChecked();
    const save = page.getByRole("button", { name: "Opslaan", exact: true }).first();
    await expect(save).toBeDisabled(); await confirmed.check();
    await source.selectOption(id(10)); await expect(confirmed).toHaveCount(0);
    await source.selectOption(id(11)); await expect(confirmed).toBeEnabled(); await expect(confirmed).not.toBeChecked();
    await confirmed.check(); await hitTarget(save); await save.click();
    await expect(page.getByText("Je bronontwerp is opgeslagen.", { exact: false })).toBeVisible();
    await expect(confirmed).toHaveCount(0); await expect(save).toBeDisabled();
    await record(page, info, "source-change-canonical-baseline"); await widths(page, info, "source-canonical");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(assetReads.size).toBeGreaterThan(0);
    for (const [path, proof] of assetReads) {
      const bytes = readFileSync(path);
      expect({ sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }).toEqual(proof);
    }
    const trace = info.outputPath("transport-proof.json");
    writeFileSync(trace, JSON.stringify({ requests, errors, assetReads: [...assetReads], boundary: "actual UI with controlled transport; no live Auth/RLS/device claim" }, null, 2));
    await info.attach("transport-proof", { path: trace, contentType: "application/json" });
  });
}
