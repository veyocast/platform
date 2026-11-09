import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { SportlinkSeasonApplyRequest, SportlinkSeasonPreviewRequest } from "../../packages/contracts/src/sportlink-season-switch";
import { seasonActorScope, seasonDatabaseFixture, seasonId, seasonInventoryFixture, seasonPreviewFixture } from "../helpers/s301-season-fixtures";

// Real Control workbench and shared CSS, controlled action/navigation transport.
// SQL and hosted publication evidence are separate; these fixtures are synthetic.
const origin = "http://127.0.0.1:3391";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SeasonSwitchWorkspace}from'./apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-workspace';import{SeasonSwitchFilters}from'./apps/control/app/(shell)/dashboard/sources/sportlink/season-switch/season-switch-filters';function App(){const[actor,setActor]=useState(globalThis.fixtureActor);globalThis.setFixtureActor=setActor;return <div className="sync-control app-shell" style={{display:'block'}}><main id="control-content" style={{padding:16,maxWidth:1280,margin:'auto'}}><h1>Seizoenswissel</h1><SeasonSwitchFilters connections={[{id:globalThis.fixtureInventory.connection.id,name:globalThis.fixtureInventory.connection.name}]} seasons={globalThis.fixtureInventory.seasons} values={globalThis.fixtureFilters}/><SeasonSwitchWorkspace key={actor} inventory={globalThis.fixtureInventory} actorScope={actor} canWriteDesigns={!globalThis.fixtureViewer} canWriteRunbooks={false}/></main></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const linkSource = 'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{...props,href},children)}';
  const script = `const r=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl','.png':'dataurl','.svg':'dataurl','.webp':'dataurl'},plugins:[{name:'controlled-boundaries',setup(b){b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:${JSON.stringify(linkSource)},loader:'js',resolveDir:process.cwd()+'/apps/control'}));b.onResolve({filter:/season-switch-actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'async function call(kind,input,scope){const r=await fetch("/__season/"+kind,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input,scope})});if(!r.ok)throw Error("Transport unavailable");return r.json()}export const previewSeasonSwitchAction=(input,scope)=>call("preview",input,scope);export const applySeasonSwitchAction=(input,scope)=>call("apply",input,scope);',loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{refresh:()=>{globalThis.refreshCount=(globalThis.refreshCount||0)+1}}}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:r.outputFiles.find(f=>f.path.endsWith('.js')).text,css:r.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, options: { dropFirst?: boolean; viewer?: boolean; conflictFirst?: boolean; storageBlocked?: boolean; databaseCapture?: boolean } = {}) {
  const capture = options.databaseCapture ? seasonDatabaseFixture() : null;
  const inventory = capture?.inventory ?? seasonInventoryFixture();
  const errors: string[] = [], previews: SportlinkSeasonPreviewRequest[] = [], writes: SportlinkSeasonApplyRequest[] = [];
  const receipts = new Map<string, unknown>();
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" });
  });
  await page.route(`${origin}/__season/preview`, route => {
    const body = route.request().postDataJSON() as { input: SportlinkSeasonPreviewRequest; scope: string };
    expect(body.scope).toBe(seasonActorScope); previews.push(body.input);
    if (capture) {
      const expected = Object.fromEntries(Object.entries(capture.command).filter(([key]) => key !== "requestId" && key !== "correlationId"));
      expect(body.input).toEqual(expected);
    }
    return route.fulfill({ json: { ok: true, review: capture?.preview ?? seasonPreviewFixture(body.input), screenPreview: null } });
  });
  await page.route(`${origin}/__season/apply`, route => {
    const body = route.request().postDataJSON() as { input: SportlinkSeasonApplyRequest; scope: string };
    expect(body.scope).toBe(seasonActorScope); writes.push(body.input);
    if (!receipts.has(body.input.requestId)) receipts.set(body.input.requestId, {
      schemaVersion: 1, status: options.conflictFirst && receipts.size === 0 ? "conflict" : "applied",
      resourceKind: body.input.resourceKind, resourceId: body.input.resourceId, requestId: body.input.requestId, correlationId: body.input.correlationId,
      receiptId: seasonId(100 + receipts.size), previousVersionId: body.input.basisVersionId, draftVersionId: seasonId(200 + receipts.size),
      previousRevision: body.input.expectedRevision, newRevision: body.input.expectedRevision + 1, reason: options.conflictFirst && receipts.size === 0 ? "Het concept is intussen gewijzigd." : null,
      links: { edit: `/dashboard/slides/${body.input.resourceId}/edit`, publish: `/dashboard/playlists/${seasonId(40)}/publish`, restore: `/dashboard/publications/${seasonId(41)}` }
    });
    if (options.dropFirst && writes.length === 1) return route.abort();
    return route.fulfill({ json: { ok: true, receipt: receipts.get(body.input.requestId) } });
  });
  await page.route(`${origin}/__season/fixture*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seizoenswissel · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureInventory=${JSON.stringify(inventory)};globalThis.fixtureFilters=Object.fromEntries(new URLSearchParams(location.search));globalThis.fixtureFilters.connectionId??=globalThis.fixtureInventory.connection.id;globalThis.fixtureFilters.targetSeasonId??=globalThis.fixtureInventory.targetSeasonId;globalThis.fixtureActor=${JSON.stringify(seasonActorScope)};globalThis.fixtureViewer=${Boolean(options.viewer)};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  if (options.storageBlocked) await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error("quota"); }; });
  await page.goto(`${origin}/__season/fixture`);
  await expect(page.getByRole("heading", { name: "Broncontrole", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { errors, previews, writes, receipts };
}

async function reviewFirst(page: Page) {
  await page.getByRole("checkbox", { name: "Gedeelde poulestand selecteren", exact: true }).check();
  await page.getByRole("button", { name: "Wijzigingen controleren", exact: true }).click();
  await expect(page.getByRole("region", { name: "Controle Gedeelde poulestand", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /Ik bevestig alleen deze 1 gecontroleerde conceptwijzigingen/ }).check();
}

for (const width of [320, 1440]) test(`season review is readable and unselected at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const fixture = await mount(page);
  const boxes = page.getByRole("checkbox", { name: /selecteren$/ });
  await expect(boxes).toHaveCount(4);
  for (const box of await boxes.all()) await expect(box).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Alle teams en contexten selecteren", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Bevroren oude bekerdag selecteren", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Wijzigingen controleren", exact: true })).toBeDisabled();
  await expect(page.getByText("Wedstrijddag-draaiboeken zijn nog niet volledig geïnventariseerd.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(fixture.previews).toEqual([]); expect(fixture.writes).toEqual([]); expect(fixture.errors).toEqual([]);
  expect((await new AxeBuilder({ page }).include("#control-content").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await info.attach(`season-switch-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  if (process.env.S301_CAPTURE_DIR) { await mkdir(process.env.S301_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.S301_CAPTURE_DIR, `season-switch-${width}.png`), fullPage: true }); }
});

test("same-name league and cup contexts require an explicit reviewed choice", async ({ page }) => {
  const fixture = await mount(page);
  await page.getByRole("checkbox", { name: "Beker en competitie selecteren", exact: true }).check();
  await page.getByRole("button", { name: "Wijzigingen controleren", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kies voor ieder team");
  expect(fixture.previews).toHaveLength(0); expect(fixture.writes).toHaveLength(0);
  const row = page.getByRole("article").filter({ has: page.getByText("Beker en competitie", { exact: true }) });
  await row.getByRole("combobox").focus();
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(row.getByRole("combobox")).toHaveValue("2".repeat(64));
  await page.getByRole("button", { name: "Wijzigingen controleren", exact: true }).click();
  await expect(page.getByRole("region", { name: "Controle Beker en competitie", exact: true })).toContainText("cup-pool");
  expect(fixture.previews[0]!.newSelection.mappings[0]!.context).toMatchObject({ competitionId: "cup", poolId: "cup-pool", phaseId: "cup-phase", seasonId: "2026/2027" });
  expect(fixture.writes).toEqual([]);
});

test("only a concrete confirmed selection writes drafts, with no automatic publication", async ({ page }) => {
  const fixture = await mount(page);
  await reviewFirst(page);
  expect(fixture.writes).toEqual([]);
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ontvangstrapport", exact: true })).toBeVisible();
  await expect(page.getByText("Concept bijgewerkt", { exact: true })).toBeVisible();
  await expect(page.getByText(/Nog niet gepubliceerd\./)).toBeVisible();
  expect(fixture.writes).toHaveLength(1); expect(fixture.writes[0]!.resourceId).toBe(seasonId(3));
  expect(fixture.writes[0]).not.toHaveProperty("configuration"); expect(fixture.writes[0]).not.toHaveProperty("publish");
  await expect(page.getByRole("link", { name: "Via bestaande preflight voorbereiden", exact: true })).toHaveAttribute("href", `/dashboard/playlists/${seasonId(40)}/publish`);
  expect(fixture.errors).toEqual([]);
});

test("lost responses survive reload and retry the exact same request and nonce", async ({ page }) => {
  const fixture = await mount(page, { dropFirst: true });
  await reviewFirst(page);
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).click();
  await expect(page.getByText("Antwoord in afwachting", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dezelfde opdrachten controleren", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ontvangstrapport", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dezelfde opdrachten controleren", exact: true }).click();
  await expect(page.getByText("Concept bijgewerkt", { exact: true })).toBeVisible();
  expect(fixture.writes).toHaveLength(2); expect(fixture.writes[1]).toEqual(fixture.writes[0]); expect(fixture.receipts.size).toBe(1);
});

test("a revision conflict and a successful resource have separate truthful outcomes", async ({ page }) => {
  const fixture = await mount(page, { conflictFirst: true });
  await page.getByRole("checkbox", { name: "Gedeelde poulestand selecteren", exact: true }).check();
  await page.getByRole("checkbox", { name: "Beker en competitie selecteren", exact: true }).check();
  const row = page.getByRole("article").filter({ has: page.getByText("Beker en competitie", { exact: true }) });
  await row.getByRole("combobox").selectOption("1".repeat(64));
  await page.getByRole("button", { name: "Wijzigingen controleren", exact: true }).click();
  await page.getByRole("checkbox", { name: /Ik bevestig alleen deze 2 gecontroleerde conceptwijzigingen/ }).check();
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).click();
  await expect(page.getByText("Conflict — opnieuw controleren", { exact: true })).toBeVisible();
  await expect(page.getByText("Concept bijgewerkt", { exact: true })).toBeVisible();
  expect(fixture.writes.map(write => write.resourceId)).toEqual([seasonId(3), seasonId(5)]);
  expect(new Set(fixture.writes.map(write => write.correlationId)).size).toBe(1);
});

test("unavailable local command storage sends no write", async ({ page }) => {
  const fixture = await mount(page, { storageBlocked: true });
  await reviewFirst(page);
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Er is niets verstuurd");
  expect(fixture.writes).toEqual([]);
});

test("read-only task rights keep identity and impact visible without a write selection", async ({ page }) => {
  const fixture = await mount(page, { viewer: true });
  for (const box of await page.getByRole("checkbox", { name: /selecteren$/ }).all()) await expect(box).toBeDisabled();
  await expect(page.getByRole("article").getByRole("combobox")).toHaveCount(0);
  await page.getByText("Gebruik en publicaties · 5 bekend", { exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Terugkerende zaterdag", exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Historisch Playerframe/).first()).toBeVisible();
  await expect(page.getByText(/eerder gemeld; huidige weergave niet bevestigd/).first()).toBeVisible();
  expect(fixture.writes).toEqual([]); expect(fixture.previews).toEqual([]);
});

test("real filter form retains target, source and query intent in its GET navigation", async ({ page }) => {
  const fixture = await mount(page);
  await page.getByRole("searchbox", { name: "Zoek ontwerp, context of status", exact: true }).fill("Eigen * beker");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("attention");
  await page.getByRole("combobox", { name: "Objecttype", exact: true }).selectOption("dynamic_slide");
  await page.getByRole("button", { name: "Inventaris controleren", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Eigen * beker");
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ connectionId: seasonId(10), targetSeasonId: "2026/2027", status: "attention", resourceKind: "dynamic_slide" });
  expect(fixture.previews).toEqual([]); expect(fixture.writes).toEqual([]);
});

test("a rapid repeated confirmation starts one durable command batch", async ({ page }) => {
  const fixture = await mount(page);
  await reviewFirst(page);
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByText("Concept bijgewerkt", { exact: true })).toBeVisible();
  expect(fixture.writes).toHaveLength(1); expect(fixture.receipts.size).toBe(1);
});

test("pending receipts stay isolated across actor changes and recover in the original scope", async ({ page }) => {
  const fixture = await mount(page, { dropFirst: true });
  await reviewFirst(page);
  await page.getByRole("button", { name: "Concepten bijwerken", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dezelfde opdrachten controleren", exact: true })).toBeEnabled();
  await page.evaluate(scope => (globalThis as unknown as { setFixtureActor(value: string): void }).setFixtureActor(scope), `${seasonId(1)}:${seasonId(99)}`);
  await expect(page.getByRole("heading", { name: "Ontvangstrapport", exact: true })).toHaveCount(0);
  await page.evaluate(scope => (globalThis as unknown as { setFixtureActor(value: string): void }).setFixtureActor(scope), seasonActorScope);
  await expect(page.getByRole("button", { name: "Dezelfde opdrachten controleren", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Dezelfde opdrachten controleren", exact: true }).click();
  await expect(page.getByText("Concept bijgewerkt", { exact: true })).toBeVisible();
  expect(fixture.writes[1]).toEqual(fixture.writes[0]); expect(fixture.receipts.size).toBe(1);
});

test("an unreadable previous command journal blocks new writes instead of replacing its nonce", async ({ page }) => {
  await page.addInitScript(key => { sessionStorage.setItem(key, "invalid-json"); }, `veyocast.season-switch.v1:${seasonActorScope}`);
  const fixture = await mount(page);
  await expect(page.getByRole("alert")).toContainText("Er wordt geen nieuwe opdracht verstuurd");
  await expect(page.getByRole("checkbox", { name: "Gedeelde poulestand selecteren", exact: true })).toBeDisabled();
  expect(fixture.writes).toEqual([]); expect(fixture.previews).toEqual([]);
});

test("isolated canonical RPC capture renders exact context, impact and valid empty review", async ({ page }) => {
  const capture = seasonDatabaseFixture();
  expect(capture.replay).toEqual(capture.applied);
  const fixture = await mount(page, { databaseCapture: true });
  const row = capture.inventory.rows.find(item => item.resourceId === capture.command.resourceId)!;
  const article = page.getByRole("article").filter({ has: page.getByText(row.name, { exact: true }) });
  await page.getByRole("checkbox", { name: `${row.name} selecteren`, exact: true }).check();
  for (const binding of row.bindings) {
    const mapping = capture.command.newSelection.mappings.find(item => item.fromProviderTeamId === binding.fromProviderTeamId)!;
    const candidate = binding.candidates.find(item => Object.entries(mapping.context).every(([key, value]) => item.context[key as keyof typeof item.context] === value))!;
    await article.getByRole("combobox", { name: `Nieuwe context voor team ${binding.fromProviderTeamId}`, exact: true }).selectOption(candidate.candidateId);
  }
  await page.getByRole("button", { name: "Wijzigingen controleren", exact: true }).click();
  const review = page.getByRole("region", { name: `Controle ${row.name}`, exact: true });
  await expect(review).toContainText("poule 801");
  await expect(review).toContainText("fase new-phase");
  await expect(review).toContainText("Schermvoorbeeld geldig leeg.");
  await expect(review).toContainText(capture.preview.preview.message!);
  await expect(page.getByRole("checkbox", { name: /Ik bevestig alleen deze 1 gecontroleerde conceptwijzigingen/ })).not.toBeChecked();
  expect(fixture.previews).toHaveLength(1); expect(fixture.writes).toEqual([]); expect(fixture.errors).toEqual([]);
});
