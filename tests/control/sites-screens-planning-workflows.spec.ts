import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Real production components, exact original case IDs and viewports. Only the
// authenticated command transport and Next refresh are controlled here. Actual
// atomic create/composition/planning/RLS gates remain separate database tests.
const origin = `http://127.0.0.1:${process.env.CONTROL_PORT ?? 3313}`;
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const entry = `import React from'react';import{createRoot}from'react-dom/client';
import{ScreenSetupDialog}from'./apps/control/app/(shell)/dashboard/screens/screen-setup-dialog';
import{ScreenCompositionEditor}from'./apps/control/app/(shell)/dashboard/screens/screen-composition-editor';
import{ContentScheduleDialog}from'./apps/control/app/(shell)/dashboard/planning/planning-dialogs';
const id=n=>'19170000-0000-4000-8000-'+String(n).padStart(12,'0');
const playlist=id(40),release=id(41),groups=[{id:id(30),name:'Binnen',memberIds:[id(20),id(21)],memberCount:2}];
const screens=[{id:id(20),name:'Kantine TV 1',orientation:'landscape',defaultPlaylistId:playlist,status:'active',disabled:false},{id:id(21),name:'Kantine TV 2',orientation:'landscape',defaultPlaylistId:playlist,status:'active',disabled:false},{id:id(22),name:'Entree',orientation:'portrait',defaultPlaylistId:playlist,status:'active',disabled:false}];
const previews=[{id:playlist,name:'Clubhuis — Vandaag',published:true,previewUrl:'/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp'}];
const mode=new URLSearchParams(location.search).get('mode');
createRoot(document.getElementById('root')).render(<React.StrictMode><main><h1>Duindorp SV · QA-01</h1>{mode==='setup'?<ScreenSetupDialog disabled={false}groups={groups}releases={[{id:release,playlistId:playlist,playlistName:'Clubhuis — Vandaag'}]}previews={previews}settings={{width:1920,height:1080,orientation:'landscape'}}/>:mode==='composition'?<ScreenCompositionEditor canPublish data={{drafts:screens.map(screen=>({screenId:screen.id,revision:4,configuration:null})),error:null,playlists:previews,series:[]}}groups={groups}initialTarget={id(20)}screens={screens}/>:<ContentScheduleDialog defaultStartAt='2026-10-11T10:00:00.000Z'disabled={false}groups={groups}releases={[{id:release,playlistId:playlist,label:'Clubhuis — Vandaag'}]}screens={screens}timezoneName='Europe/Amsterdam'/>}</main></React.StrictMode>);`;
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const transport = `async function command(kind,input){const response=await fetch('/__sites-test/wizard-command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,input:input instanceof FormData?Object.fromEntries(input.entries()):input})});return response.json();}
export const createScreenOnboarding=input=>command('create-screen',input);
export const saveScreenComposition=input=>command('composition',input);
export const checkScheduleConflicts=input=>command('conflicts',input);
export const createContentSchedule=input=>command('create-schedule',input);
export const updateContentSchedule=input=>command('update-schedule',input);
export const deleteContentSchedule=input=>command('delete-schedule',input);
export const setContentScheduleEnabled=input=>command('enable-schedule',input);`;
  const build = `const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),sourcefile:'sites-screens-planning-fixture.tsx',loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'/tmp/sites-screens-planning-fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-command-transport',setup(build){build.onResolve({filter:/^(\\.\\/actions|\\.\\/screen-composition-actions)$/},args=>({path:args.path,namespace:'controlled-actions'}));build.onLoad({filter:/.*/,namespace:'controlled-actions'},()=>({contents:${JSON.stringify(transport)},loader:'js'}));build.onResolve({filter:/^next\\/navigation$/},()=>({path:'next/navigation',namespace:'controlled-router'}));build.onLoad({filter:/.*/,namespace:'controlled-router'},()=>({contents:'export function useRouter(){return{refresh(){window.__qaRefresh=(window.__qaRefresh||0)+1}}}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${build}})().catch(error=>{console.error(error.message);process.exitCode=1;});`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, mode: string, scheduleConflicts: Record<string, unknown>[] = []) {
  const commands: { kind: string; input: Record<string, unknown> }[] = [];
  const baseCss = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/__sites-test/screens-planning*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><style>${baseCss}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.route("**/__sites-test/wizard-command", route => { const command = route.request().postDataJSON() as typeof commands[number]; commands.push(command); return route.fulfill({ contentType: "application/json", body: JSON.stringify(command.kind === "conflicts" ? { conflicts: scheduleConflicts, error: null } : command.kind === "composition" ? { status: "published", message: "Indeling bevestigd door het gecontroleerde transport." } : { status: "saved" }) }); });
  const manifest = JSON.parse(readFileSync("docs/sites-v11-overname/system-assets.json", "utf8")) as { files: { path: string; sha256: string; bytes: number; mimeType: string }[] };
  const assets = new Map(manifest.files.map(asset => [asset.path, asset]));
  for (const pattern of ["**/fonts/**", "**/fieldflow/**"]) await page.route(pattern, route => { const asset = assets.get(new URL(route.request().url()).pathname); if (!asset) return route.abort(); const bytes = readFileSync(join(process.cwd(), "apps/control/public", asset.path)); expect(bytes.byteLength).toBe(asset.bytes); expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256); return route.fulfill({ contentType: asset.mimeType, body: bytes }); });
  await page.goto(`${origin}/__sites-test/screens-planning?mode=${mode}`);
  await page.getByRole("button", { name: mode === "setup" ? "Nieuw scherm" : mode === "composition" ? "Schermindeling" : "Nieuw moment", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return commands;
}

for (const overlap of [false, true]) test(`definitieve planning ${overlap ? "bevestigt overlap expliciet" : "slaat met één klik op"}`, async ({ page }) => {
  const commands = await mount(page, "planning", overlap ? [{
    endsAt: "2026-10-11T12:00:00.000Z", priority: 100,
    scheduleId: "19170000-0000-4000-8000-000000000050", scheduleName: "Bestaand moment",
    screenId: "19170000-0000-4000-8000-000000000020", screenName: "Kantine TV 1",
    source: "publisher", startsAt: "2026-10-11T10:00:00.000Z"
  }] : []);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Naam van het moment").fill("Eenmalig clubprogramma");
  await dialog.getByLabel("Content", { exact: true }).selectOption("19170000-0000-4000-8000-000000000040");
  await dialog.getByRole("button", { name: "Volgende", exact: true }).click();
  await dialog.getByLabel("Van", { exact: true }).fill("12:00");
  await dialog.getByLabel("Tot", { exact: true }).fill("14:00");
  await dialog.getByRole("button", { name: "Volgende", exact: true }).click();
  await expect(dialog.locator('ol li[aria-current="step"]')).toContainText("Controleren");
  expect(commands.filter(command => command.kind === "create-schedule")).toHaveLength(0);
  const save = dialog.getByRole("button", { name: "Moment inplannen", exact: true });
  if (overlap) {
    await expect(save).toBeDisabled();
    await expect(dialog.getByRole("alert")).toContainText("Bestaand moment");
    await dialog.getByRole("button", { name: "Prioriteit begrijpen en toch opslaan", exact: true }).click();
  } else {
    await expect(save).toBeEnabled();
    await save.click();
  }
  await expect.poll(() => commands.filter(command => command.kind === "create-schedule").length).toBe(1);
  expect(commands.filter(command => command.kind === "conflicts")).toHaveLength(1);
  const saved = commands.find(command => command.kind === "create-schedule")!;
  expect(saved.input).toMatchObject({ name: "Eenmalig clubprogramma", confirmConflicts: overlap ? "yes" : "no" });
  expect(saved.input.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
});

function csvRows(content: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < content.length; index++) { const character = content[index]!; if (character === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; } else if (character === "," && !quoted) { row.push(cell); cell = ""; } else if (character === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += character; }
  if (cell || row.length) { row.push(cell); rows.push(row); } const headers = rows.shift()!;
  return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index] ?? ""])));
}
const cases = csvRows(readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8")).filter(row => row.case_id.startsWith("WIZARD-") && Number(row.case_id.slice(7)) >= 47 && Number(row.case_id.slice(7)) <= 64);
const directory = "/dev/shm/veyocast-s191-screens-planning-case-evidence";
const readbacks: Record<string, unknown>[] = [];
test.afterAll(() => { mkdirSync(directory, { recursive: true }); const path = join(directory, "case-readback.json"), merged = new Map<string, Record<string, unknown>>(); if (existsSync(path)) for (const row of JSON.parse(readFileSync(path, "utf8")).results as Record<string, unknown>[]) merged.set(String(row.caseId), row); for (const row of readbacks) merged.set(String(row.caseId), row); writeFileSync(path, JSON.stringify({ schemaVersion: 1, sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", implementationBaseSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), fixtureVersion: "QA-01-SCREENS-PLANNING-20261011-v1", fixedTime: "2026-10-11T10:00:00.000Z", timezone: "Europe/Amsterdam", browser: "Chromium1228 / Linux / DPR1", scope: "Actual production Source components; authenticated command/refresh transport controlled. Case-specific wizard controls/state/back/validation/preview assertions; actual atomic database commands tested separately. No inferred original-source pixel parity.", results: [...merged.values()].sort((a, b) => String(a.caseId).localeCompare(String(b.caseId))) }, null, 2)); });

for (const row of cases) test(`original ${row.case_id} ${row.viewport} ${row.state}`, async ({ page }) => {
  const [width, height] = row.viewport.split("x").map(Number); await page.setViewportSize({ width: width!, height: height! }); await page.clock.install({ time: new Date("2026-10-11T10:00:00.000Z") });
  const number = Number(row.case_id.slice(7)), mode = number <= 52 ? "setup" : number <= 58 ? "composition" : "planning", step = Number(row.state.slice(0, 1)) - 1;
  const commands = await mount(page, mode), dialog = page.getByRole("dialog");
  const labels = mode === "setup" ? ["Scherm", "Content", "Controleren"] : mode === "composition" ? ["Indeling", "Zonecontent", "Controleren"] : ["Content & schermen", "Wanneer", "Controleren"];
  const active = () => dialog.locator('ol li[aria-current="step"]');
  await expect(active()).toContainText(labels[0]!);
  if (mode === "setup") {
    await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(active()).toContainText("Scherm"); await expect(dialog.getByLabel("Schermnaam", { exact: true })).toBeFocused();
    await dialog.getByLabel("Schermnaam", { exact: true }).fill("Kantine TV 3"); await expect(dialog.locator(".field > span")).toHaveText(["Schermnaam", "Schermgroep", "Oriëntatie", "Locatie", "Breedte", "Hoogte"]);
    if (step >= 1) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByLabel("Standaard afspeellijst").selectOption("19170000-0000-4000-8000-000000000041"); await expect(dialog.getByRole("img", { name: "Voorbeeld Clubhuis — Vandaag" })).toBeVisible(); await dialog.getByRole("button", { name: "Vorige", exact: true }).click(); await expect(dialog.getByLabel("Schermnaam", { exact: true })).toHaveValue("Kantine TV 3"); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByLabel("Standaard afspeellijst")).toHaveValue("19170000-0000-4000-8000-000000000041"); }
    if (step === 2) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByText("Kantine TV 3", { exact: true })).toBeVisible(); await expect(dialog.getByText("Clubhuis — Vandaag", { exact: true })).toBeVisible(); }
  } else if (mode === "composition") {
    await dialog.getByLabel("Toepassen op").selectOption("group:19170000-0000-4000-8000-000000000030"); await dialog.getByRole("button", { name: "Drie zones", exact: true }).click(); await expect(dialog.getByRole("button", { name: "Drie zones", exact: true })).toHaveAttribute("aria-pressed", "true");
    if (step >= 1) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("iedere zichtbare zone"); for (const label of ["Hoofdvlak", "Zijbalk", "Onderbalk"]) await dialog.getByLabel(label, { exact: true }).selectOption("playlist:19170000-0000-4000-8000-000000000040"); await dialog.getByLabel("Breedte hoofdvlak", { exact: true }).focus(); await page.keyboard.press("Home"); for(let index=0;index<3;index++)await page.keyboard.press("ArrowRight"); await dialog.getByLabel("Hoogte onderbalk", { exact: true }).focus(); await page.keyboard.press("Home"); for(let index=0;index<2;index++)await page.keyboard.press("ArrowRight"); await dialog.getByRole("button", { name: "Vorige", exact: true }).click(); await expect(dialog.getByLabel("Toepassen op")).toHaveValue("group:19170000-0000-4000-8000-000000000030"); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByLabel("Breedte hoofdvlak", { exact: true })).toHaveValue("65"); }
    if (step === 2) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByText("Gereed voor 2 schermen", { exact: true })).toBeVisible(); await expect(dialog.locator("dl dd")).toHaveText(["Clubhuis — Vandaag", "Clubhuis — Vandaag", "Clubhuis — Vandaag"]); }
  } else {
    await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(active()).toContainText("Content & schermen"); await dialog.getByLabel("Naam van het moment").fill("Wedstrijddag Heren 1"); await dialog.getByLabel("Content", { exact: true }).selectOption("19170000-0000-4000-8000-000000000040"); await expect(dialog.getByText("3 schermen geselecteerd", { exact: true })).toBeVisible();
    if (step >= 1) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await dialog.getByLabel("Van", { exact: true }).fill("12:00"); await dialog.getByLabel("Tot", { exact: true }).fill("14:00"); await dialog.getByLabel("Kalenderkleur").selectOption("orange"); await dialog.getByRole("button", { name: "Vorige", exact: true }).click(); await expect(dialog.getByLabel("Naam van het moment")).toHaveValue("Wedstrijddag Heren 1"); await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(dialog.getByLabel("Van", { exact: true })).toHaveValue("12:00"); await expect(dialog.getByLabel("Kalenderkleur")).toHaveValue("orange"); }
    if (step === 2) { await dialog.getByRole("button", { name: "Volgende", exact: true }).click(); await expect(active()).toContainText("Controleren"); await expect(dialog.getByRole("heading", { name: "Wedstrijddag Heren 1" })).toBeVisible(); expect(commands).toHaveLength(1); expect(commands[0]).toMatchObject({ kind: "conflicts", input: { startsAtIso: "2026-10-11T10:00:00.000Z", endsAtIso: "2026-10-11T12:00:00.000Z", targetKind: "all" } }); }
  }
  await expect(active()).toContainText(labels[step]!); await expect(dialog.getByRole("button", { name: step < 2 ? "Volgende" : mode === "setup" ? "Scherm toevoegen" : mode === "composition" ? "Indeling opslaan" : "Moment inplannen", exact: true })).toBeVisible();
  const geometry = await dialog.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; }); expect(geometry.left).toBeGreaterThanOrEqual(-1); expect(geometry.right).toBeLessThanOrEqual(width! + 1); expect(geometry.top).toBeGreaterThanOrEqual(-1); expect(geometry.bottom).toBeLessThanOrEqual(height! + 1); expect(geometry.overflow).toBe(false);
  await page.evaluate(async () => { await Promise.all([document.fonts.load('14px "Inter Variable"'), document.fonts.load('14px "Manrope Variable"')]); await document.fonts.ready; await Promise.all([...document.images].filter(image => image.getBoundingClientRect().width > 0).map(image => image.decode())); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  const fonts = await page.evaluate(() => ({ inter: [...document.fonts].some(font => font.family.includes("Inter Variable") && font.status === "loaded"), manrope: [...document.fonts].some(font => font.family.includes("Manrope Variable") && font.status === "loaded") })); expect(fonts.inter).toBe(true); expect(fonts.manrope).toBe(true);
  mkdirSync(directory, { recursive: true }); const screenshot = join(directory, `${row.case_id}.png`); await page.screenshot({ path: screenshot, fullPage: true });
  readbacks.push({ caseId: row.case_id, viewport: row.viewport, setup: row.setup, state: row.state, expected: row.assertions, componentSha256: createHash("sha256").update(readFileSync(`apps/control/app/(shell)/dashboard/${mode === "planning" ? "planning/planning-dialogs.tsx" : mode === "composition" ? "screens/screen-composition-editor.tsx" : "screens/screen-setup-dialog.tsx"}`)).digest("hex"), status: "PASS", date: new Date().toISOString(), actual: "Correct active step/order, back preserves entered values, invalid advancement blocked, required preview/controls visible, exact viewport contained, audited fonts and images loaded. No write or device acknowledgement inferred.", fonts, geometry, screenshot, screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex"), commandCount: commands.length });
});
