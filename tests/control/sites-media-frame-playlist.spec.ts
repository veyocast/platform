import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mediaFrameDefaultSettings, type PlaylistBatchCommand } from "../../packages/contracts/src/index";
import type { SitesPlaylistWorkspace } from "../../apps/control/app/(shell)/dashboard/playlists/_components/sites/sites-playlist-workspace";

// Actual Workspace, planner, journal and Editor. Only navigation, unused theme
// jobs and the server-action transport are isolated. No authenticated RPC claim.
type Props = Parameters<typeof SitesPlaylistWorkspace>[0];
const origin = "http://127.0.0.1:3374";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SitesPlaylistWorkspace}from'./apps/control/app/(shell)/dashboard/playlists/_components/sites/sites-playlist-workspace';function App(){const[props,setProps]=useState(globalThis.fixtureProps);globalThis.replaceFixtureProps=setProps;return <main className="sync-control"><h1 className="sync-sr-only">Eigen playlist</h1><SitesPlaylistWorkspace {...props}/></main>}createRoot(document.getElementById('root')).render(<App/>);`;
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transport',setup(b){b.onResolve({filter:/sites-batch-actions$/},a=>({path:a.path,namespace:'batch'}));b.onLoad({filter:/.*/,namespace:'batch'},()=>({contents:'export async function savePlaylistBatch(command,actorScope){const response=await fetch("/__playlist/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,actorScope})});if(!response.ok)throw Error("Transport unavailable");return response.json()}',loader:'js'}));b.onResolve({filter:/(sites-placement-theme-actions|sync-dynamic-placement-actions)$/},a=>({path:a.path,namespace:'unused-jobs'}));b.onLoad({filter:/.*/,namespace:'unused-jobs'},()=>({contents:'const unexpected=()=>{throw Error("Raw frame must not prepare a themed export")};export const prepareStudioPlacementThemeAction=unexpected,prepareMediaPlacementThemeAction=unexpected,readStudioPlacementThemeRenderAction=unexpected,prepareSyncDynamicPlacementAction=unexpected,readSyncDynamicPlacementAction=unexpected;',loader:'js'}));b.onResolve({filter:/prepare-studio-library$/},a=>({path:a.path,namespace:'unused-series'}));b.onLoad({filter:/.*/,namespace:'unused-series'},()=>({contents:'export const preparePublisherStudioSeries=()=>{throw Error("Unused series preparation")},preparePublisherSyncProject=preparePublisherStudioSeries;',loader:'js'}));b.onResolve({filter:/video-upload-form$/},a=>({path:a.path,namespace:'unused-video'}));b.onLoad({filter:/.*/,namespace:'unused-video'},()=>({contents:'export function VideoUploadForm(){return null}',loader:'js'}));b.onResolve({filter:/^\\//},()=>({external:true}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)},refresh:()=>{globalThis.refreshCount=(globalThis.refreshCount||0)+1}}}',loader:'js'}));b.onResolve({filter:/^next\\/(link|image)$/},a=>({path:a.path,namespace:'next-view'}));b.onLoad({filter:/.*/,namespace:'next-view'},a=>({contents:a.path.endsWith('image')?'import React from"react";export default function Image({fill,unoptimized,...props}){return React.createElement("img",props)}':'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));}}]});const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text,css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Missing actual Workspace JS/CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});
const id = (n: number) => `19170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(10), actor = id(11), frame = id(20), asset = id(30), playlistId = id(500), item = id(100);
const sourceSettings = mediaFrameDefaultSettings({ kind: "image", title: "Vaste eerste titel", durationSeconds: null });
const version = (n: number) => ({ id: id(n), number: n, settings: { ...sourceSettings, name: n === 1 ? "Vaste eerste titel" : "Nieuwe vaste titel", durationSeconds: n === 1 ? 601 : 901, focus: "right" as const }, mediaAssetId: asset, checksumSha256: "a".repeat(64), image: `${origin}/private-image.svg?temporary-token=not-in-journal`, kind: "image" as const });
const initial = (): Props["initial"] => ({ id: playlistId, name: "Eigen playlist", description: "", status: "Concept", updated: "", slides: [{ id: item, name: "Vaste eerste titel", seconds: 601, image: version(1).image, mediaId: asset, kind: "image", mediaFrame: { frameId: frame, pinnedVersionId: id(1), pinnedVersionNumber: 1, selected: version(1), current: version(2), overrides: {}, fitMode: "contain", cropFocusX: 0.5, cropFocusY: 0.5, backgroundColor: null } }] });
type Hooks = { dropFirst?: boolean; conflict?: boolean; staleReload?:boolean; holdReplay?:boolean };
async function mount(page: Page, hooks: Hooks = {}) {
  const errors: string[] = [], writes: Array<{ command: PlaylistBatchCommand; actorScope: string }> = [];
  page.on("pageerror", error => errors.push(error.message));
  const state = { revision: 7, initial: initial(), props: null as Props | null, applications: 0 };
  const receipts = new Map<string, unknown>();
  let resumeReplay:(()=>void)|null=null;
  const props = (): Props => ({ tenantId: tenant, actorScope: `${tenant}:${actor}`, tenantName: "Eigen vereniging", initial: structuredClone(hooks.staleReload?initial():state.initial), revision: hooks.staleReload?7:state.revision, inventory: [], groups: [], media: [], designs: [], projects: [], canWrite: true, canPublish: true });
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => { const name = new URL(route.request().url()).pathname.split("/").at(-1)!; if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort(); return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : "image/webp" }); });
  await page.route(`${origin}/private-image.svg*`, route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#123332"/></svg>' }));
  await page.route(`${origin}/api/publisher/library*`, route => {
    const binding = initial().slides[0]!.mediaFrame!;
    const media = [{ id: asset, name: "Primair ontwerp", image: version(1).image, kind: "image", folder: "Eigen", size: "1 MB", mediaFrame: binding }, { id: id(21), name: "Eigen kopie", image: version(2).image, kind: "image", folder: "Eigen", size: "1 MB", mediaFrame: { ...binding, frameId: id(21), pinnedVersionId: id(4), pinnedVersionNumber: 4, selected: { ...version(2), id: id(4), number: 4, settings: { ...version(2).settings, name: "Eigen kopie" } }, current: null } }];
    return route.fulfill({ json: { media, projects: [], designs: [], folders: [], collections: [], total: 2, hasMore: false } });
  });
  await page.route(`${origin}/__playlist/batch`, async route => {
    const request = route.request().postDataJSON() as typeof writes[number]; writes.push(request);
    let result = receipts.get(request.command.idempotencyKey);
    if (!result) {
      if (hooks.conflict && writes.length === 1) result = { outcome: "failed", uncertain: false, message: "Een ontwerp is intussen gewijzigd. Je concept blijft open; laad de nieuwste versie en vergelijk de wijzigingen." };
      else {
        state.applications++; state.revision++;
        for (const operation of request.command.operations) {
          if (operation.operation === "refresh_media_frame") { const slide = state.initial.slides[0]!; slide.name = "Nieuwe vaste titel"; slide.seconds = 901; slide.mediaFrame = { ...slide.mediaFrame!, selected: version(2), pinnedVersionId: id(2), pinnedVersionNumber: 2 }; }
          if (operation.operation === "details") { state.initial.name = operation.name; state.initial.description = operation.description; }
          if (operation.operation === "patch") { if (operation.patch.durationSeconds !== undefined) state.initial.slides[0]!.seconds = operation.patch.durationSeconds; }
        }
        result = { outcome: "applied", actualRevision: state.revision, itemIds: {} };
      }
      receipts.set(request.command.idempotencyKey, result);
    }
    if (hooks.dropFirst && writes.length === 1) return route.abort();
    if(hooks.holdReplay&&writes.length===2)await new Promise<void>(resolve=>{resumeReplay=resolve;});
    return route.fulfill({ json: result });
  });
  await page.route(`${origin}/__playlist/fixture`, route => { state.props = props(); return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Playlist · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify(state.props).replace(/</g, "\\u003c")};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }); });
  await page.goto(`${origin}/__playlist/fixture`);
  await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeEnabled();
  return { errors, writes, state, releaseReplay:()=>{if(!resumeReplay)throw Error('Replay not waiting at transport');resumeReplay();},replace: async (change: Partial<Props>) => { state.props = { ...state.props!, ...change }; await page.evaluate(value => (globalThis as typeof globalThis & { replaceFixtureProps: (props: Props) => void }).replaceFixtureProps(value), state.props); } };
}
async function settings(page: Page) { await page.getByRole("button", { name: /601 seconden, instellingen openen/ }).click(); await expect(page.getByRole("region", { name: "Playlistinhoud", exact: true }).getByLabel("Seconden in beeld", { exact: true })).toHaveValue("601"); }
async function chooseCurrent(page: Page) { await settings(page); await page.getByRole("button", { name: "Media-ontwerpversie 2 kiezen", exact: true }).click(); }
async function pendingJournal(page: Page) { return page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith("veyocast-playlist-batch-v1:"))); }

for (const width of [390, 1440]) test(`explicit immutable version refresh preserves long duration and accessible raw preview at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const fixture = await mount(page);
  await chooseCurrent(page); await expect(page.getByRole("region", { name: "Playlistinhoud", exact: true }).getByLabel("Seconden in beeld", { exact: true })).toHaveValue("901");
  await expect(page.getByRole("region", { name: "Playlistinhoud", exact: true }).getByText("Vastgezet op media-ontwerpversie 1.", { exact: false })).toContainText("Versie 2 is gekozen");
  expect(fixture.writes).toEqual([]);
  const axe = await new AxeBuilder({ page }).include('[aria-label="Playlist bewerken"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); expect(axe.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible();
  expect(fixture.writes).toHaveLength(1); expect(fixture.writes[0]).toMatchObject({ actorScope: `${tenant}:${actor}`, command: { playlistId, expectedRevision: 7, operations: [{ operation: "refresh_media_frame", itemId: item, expectedPinnedVersionId: id(1), versionId: id(2) }] } });
  expect(fixture.writes[0]!.command.operations).toHaveLength(1); expect(await pendingJournal(page)).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("a deliberate same-value duration remains an override after refresh without an accidental old default patch", async ({ page }) => {
  const fixture = await mount(page); await settings(page);
  const duration = page.getByRole("region", { name: "Playlistinhoud", exact: true }).getByLabel("Seconden in beeld", { exact: true }); await duration.fill(""); await duration.fill("601"); await duration.press("Tab");
  await page.getByRole("button", { name: "Media-ontwerpversie 2 kiezen", exact: true }).click(); await expect(duration).toHaveValue("601");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible();
  expect(fixture.writes[0]!.command.operations).toEqual([{ operation: "refresh_media_frame", itemId: item, expectedPinnedVersionId: id(1), versionId: id(2) }, { operation: "patch", itemId: item, patch: { durationSeconds: 601 } }]); expect(fixture.errors).toEqual([]);
});

test("committed refresh with response loss reloads and replays the exact original batch only once", async ({ page }) => {
  const fixture = await mount(page, { dropFirst: true }); await chooseCurrent(page); await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true })).toBeEnabled();
  const first = structuredClone(fixture.writes[0]); const stored = await pendingJournal(page); expect(stored).toHaveLength(1); expect(stored[0]![1]).not.toContain("temporary-token"); expect(JSON.parse(stored[0]![1]).command).toEqual(first!.command);
  await page.reload(); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled(); await page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeEnabled(); expect(fixture.writes).toHaveLength(2); expect(fixture.writes[1]).toEqual(first); expect(fixture.state.applications).toBe(1); expect(await pendingJournal(page)).toEqual([]); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible(); expect(fixture.errors).toEqual([]);
});

test("journal write failure prevents POST and cleanup failure retains the exact original batch", async ({ page }) => {
  const fixture = await mount(page); await chooseCurrent(page);
  await page.evaluate(() => { const original = Storage.prototype.setItem; Reflect.set(globalThis, "restoreStorage", () => { Storage.prototype.setItem = original; }); Storage.prototype.setItem = function (key, value) { if (key.startsWith("veyocast-playlist-batch-v1:")) throw Error("Controlled full storage"); return original.call(this, key, value); }; });
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("Er is geen playlistopdracht verstuurd"); expect(fixture.writes).toHaveLength(0);
  await page.evaluate(() => { Reflect.get(globalThis, "restoreStorage")(); const original = Storage.prototype.removeItem; Reflect.set(globalThis, "restoreStorage", () => { Storage.prototype.removeItem = original; }); Storage.prototype.removeItem = function (key) { if (key.startsWith("veyocast-playlist-batch-v1:")) throw Error("Controlled receipt cleanup failure"); return original.call(this, key); }; });
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true })).toBeEnabled(); expect(fixture.writes).toHaveLength(1); expect(await pendingJournal(page)).toHaveLength(1);
  await page.evaluate(() => Reflect.get(globalThis, "restoreStorage")()); await page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true }).click(); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeEnabled(); expect(fixture.writes).toHaveLength(2); expect(fixture.writes[1]).toEqual(fixture.writes[0]); expect(fixture.state.applications).toBe(1); expect(await pendingJournal(page)).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("actor remount fences the pending batch while malformed same-scope recovery remains intact", async ({ page }) => {
  const fixture = await mount(page, { dropFirst: true }); await chooseCurrent(page); await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true })).toBeEnabled();
  const stored = await pendingJournal(page); await fixture.replace({ actorScope: `${tenant}:${id(12)}` }); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "Dezelfde opslag opnieuw bevestigen", exact: true })).toHaveCount(0); expect(fixture.writes).toHaveLength(1); expect(await pendingJournal(page)).toEqual(stored);
  await page.evaluate(([key]) => sessionStorage.setItem(key!, "malformed original record"), stored[0]!); await page.reload(); await expect(page.getByRole("dialog")).toContainText("herstelgegevens blijven behouden"); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled(); expect((await pendingJournal(page))[0]![1]).toBe("malformed original record"); expect(fixture.writes).toHaveLength(1); expect(fixture.errors).toEqual([]);
});

test("a definite version conflict keeps the draft and never reuses its rejected command", async ({ page }) => {
  const fixture = await mount(page, { conflict: true }); await chooseCurrent(page); await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("Een ontwerp is intussen gewijzigd"); expect(await pendingJournal(page)).toEqual([]); await expect(page.getByRole("region", { name: "Playlistinhoud", exact: true }).getByLabel("Seconden in beeld", { exact: true })).toHaveValue("901");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible(); expect(fixture.writes).toHaveLength(2); expect(fixture.writes[1]!.command.idempotencyKey).not.toBe(fixture.writes[0]!.command.idempotencyKey); expect(fixture.writes[1]!.command.operations).toEqual(fixture.writes[0]!.command.operations); expect(fixture.errors).toEqual([]);
});

test("primary and copied library frames sharing one physical asset become distinct explicit bound placements", async ({ page }) => {
  const fixture = await mount(page); await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await page.getByRole("button", { name: "Primair ontwerp, selecteren", exact: true }).click(); await page.getByRole("button", { name: "Eigen kopie, selecteren", exact: true }).click(); expect(fixture.writes).toEqual([]);
  await page.getByRole("button", { name: "2 items toevoegen", exact: true }).click(); await expect(page.getByRole("region", { name: "Playlistinhoud" }).locator("ol>li")).toHaveCount(3);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible(); expect(fixture.writes).toHaveLength(1);
  const operations = fixture.writes[0]!.command.operations; expect(operations).toHaveLength(3); expect(operations[0]).toMatchObject({ operation: "add_media_frame", frameId: frame, expectedVersionId: id(1) }); expect(operations[1]).toMatchObject({ operation: "add_media_frame", frameId: id(21), expectedVersionId: id(4) }); expect(operations[2]).toMatchObject({ operation: "reorder", itemIds: [item, expect.any(String), expect.any(String)] });
  expect(operations.some(operation => operation.operation === "add_media" || operation.operation === "replace_media" || operation.operation === "patch")).toBe(false); expect(JSON.stringify(fixture.writes[0])).not.toContain("temporary-token"); expect(fixture.errors).toEqual([]);
});

test("a fresh readmodel exposes newer frame versions without changing the pin or replacing dirty input", async ({ page }) => {
  const fixture = await mount(page); const fresh = structuredClone(fixture.state.initial); fresh.slides[0]!.mediaFrame!.current = { ...version(2), id: id(3), number: 3 };
  await fixture.replace({ initial: fresh }); await settings(page); await expect(page.getByRole("button", { name: "Media-ontwerpversie 3 kiezen", exact: true })).toBeVisible(); await expect(page.getByRole("region", { name: "Playlistinhoud" }).getByLabel("Seconden in beeld", { exact: true })).toHaveValue("601"); expect(fixture.writes).toEqual([]);
  await page.getByRole("region", { name: "Playlistinhoud" }).getByLabel("Naam in playlist", { exact: true }).fill("Mijn lokale plaatsingsnaam");
  const changed = structuredClone(fresh); changed.slides[0]!.mediaFrame!.current = { ...version(2), id: id(4), number: 4 }; await fixture.replace({ initial: changed }); await expect(page.getByRole("region", { name: "Playlistinhoud" }).getByLabel("Naam in playlist", { exact: true })).toHaveValue("Mijn lokale plaatsingsnaam"); await expect(page.getByRole("button", { name: "Media-ontwerpversie 3 kiezen", exact: true })).toBeVisible(); expect(fixture.writes).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("an authoritative filename-only server match stays selectable without exposing filename or URLs in the command", async ({ page }) => {
  const fixture = await mount(page); await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await page.getByRole("searchbox", { name: "Inhoud zoeken", exact: true }).fill("originele-bronbestandsnaam");
  await expect(page.getByRole("button", { name: "Eigen kopie, selecteren", exact: true })).toBeVisible(); await page.getByRole("button", { name: "Eigen kopie, selecteren", exact: true }).click(); await page.getByRole("button", { name: "1 item toevoegen", exact: true }).click();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(page.getByText("Geen nieuwe wijzigingen", { exact: true })).toBeVisible(); expect(fixture.writes[0]!.command.operations[0]).toMatchObject({ operation: "add_media_frame", frameId: id(21), expectedVersionId: id(4) }); expect(JSON.stringify(fixture.writes[0])).not.toContain("originele-bronbestandsnaam"); expect(fixture.errors).toEqual([]);
});

for(const color of [null,'#ffffff'])test(`explicit placement background override ${color??'cleared'} suppresses the immutable image background`,async({page})=>{
  const fixture=await mount(page);const draft=structuredClone(fixture.state.initial),binding=draft.slides[0]!.mediaFrame!;
  binding.overrides.backgroundColor=true;binding.backgroundColor=color;binding.selected.settings.appearance.background={kind:'image',mediaAssetId:id(31),position:'right'};binding.selected.backgroundImage=`${origin}/private-background.svg`;binding.selected.backgroundChecksumSha256='b'.repeat(64);
  const backgroundRequests:string[]=[];page.on('request',request=>{if(request.url().includes('private-background.svg'))backgroundRequests.push(request.url());});
  await fixture.replace({initial:draft});const background=page.getByRole('region',{name:'Playlistvoorbeeld',exact:true}).locator('img').locator('..');await expect(background).toHaveCSS('background-image','none');
  if(color)await expect(background).toHaveCSS('background-color','rgb(255, 255, 255)');
  expect(await background.evaluate(element=>(element as HTMLElement).style.background)).toBe(color?'rgb(255, 255, 255)':'var(--vc-brand-ink-black)');expect(backgroundRequests).toEqual([]);expect(fixture.writes).toEqual([]);expect(fixture.errors).toEqual([]);
});

test('fresh server props arriving during a deferred replay are reconciled after the original receipt',async({page})=>{
 const fixture=await mount(page,{dropFirst:true,staleReload:true,holdReplay:true});await chooseCurrent(page);await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.getByRole('button',{name:'Dezelfde opslag opnieuw bevestigen',exact:true})).toBeEnabled();await page.reload();
 await page.getByRole('button',{name:'Dezelfde opslag opnieuw bevestigen',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(2);await fixture.replace({initial:structuredClone(fixture.state.initial),revision:fixture.state.revision});fixture.releaseReplay();
 await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeEnabled();await expect(page.getByText('Geen nieuwe wijzigingen',{exact:true})).toBeVisible();expect(fixture.writes[1]).toEqual(fixture.writes[0]);expect(fixture.state.applications).toBe(1);expect(await pendingJournal(page)).toEqual([]);expect(fixture.errors).toEqual([]);
});
