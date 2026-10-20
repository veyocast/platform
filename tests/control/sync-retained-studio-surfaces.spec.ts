import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createEmptyStudioDocument } from "../../packages/studio/src/document";
import { createSyncStudioStarter } from "../../packages/studio/src/sync";
import type { StudioDocument } from "../../packages/studio/src/schema";

// Actual retained components, FloatingPanel, Konva canvas, Source frame and CSS.
// Only Next navigation and the server-action transport are controlled here;
// these fixtures do not establish authenticated routes or database receipts.
const origin = "http://127.0.0.1:3313";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const projectId = "24100000-0000-4000-8000-000000000001";
const revisionId = "24100000-0000-4000-8000-000000000002";
const tenantId = "24100000-0000-4000-8000-000000000003";
const artifactDirectory = process.env.S241_STUDIO_EVIDENCE_DIR;
const readbacks: Record<string, unknown>[] = [];
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{ProjectActions}from'./apps/control/app/(shell)/dashboard/studio/project-actions';import{StudioEditorWorkspace}from'./apps/control/app/(shell)/dashboard/studio/[designId]/studio-editor-workspace';import{SyncStudioEditor}from'./apps/control/app/(shell)/dashboard/studio/[designId]/sync-studio-editor';const mode=new URLSearchParams(location.search).get('mode');createRoot(document.getElementById('root')).render(<div className="sync-control app-shell" style={{display:'block'}}><main id="control-content"><h1>Eigen Studio-controle</h1>{mode==='actions'?<ProjectActions {...globalThis.fixtureProps}/>:mode==='generic'?<StudioEditorWorkspace {...globalThis.fixtureProps}/>:<SyncStudioEditor {...globalThis.fixtureProps}/>}</main></div>);`;
  const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transport',setup(b){b.onResolve({filter:/actions$/},a=>a.path.endsWith('/project-actions')?undefined:({path:a.path,namespace:'commands'}));b.onLoad({filter:/.*/,namespace:'commands'},()=>({contents:'async function post(name,input){const response=await fetch("/__retained-studio/"+name,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(!response.ok)throw Error("Controlled transport unavailable");return response.json()};'+['mutateStudioProject','restoreStudioRevision','saveStudioDraft','copyStudioConflict','requestStudioRender','cancelStudioRender','retryStudioRender','readSyncStudioDraft','readStudioPlacementThemeRender','readSyncYouTubeChoices','readSyncEngageChoices','readSyncEngageSelection','mutateSyncStudioSeries'].map(name=>'export const '+name+'Action=input=>post('+JSON.stringify(name)+',input);').join(''),loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return {push:path=>{globalThis.visited=path},refresh:()=>{globalThis.refreshes=(globalThis.refreshes||0)+1}}}',loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));}}]});const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text,css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Fixture build omitted JavaScript or CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(error=>{console.error(error.message);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 }));
});

test.afterAll(() => {
  if (!artifactDirectory) return;
  mkdirSync(artifactDirectory, { recursive: true });
  const paths = [
    "apps/control/app/(shell)/dashboard/studio/project-actions.tsx",
    "apps/control/app/(shell)/dashboard/studio/studio.module.css",
    "apps/control/app/(shell)/dashboard/studio/[designId]/studio-editor-workspace.tsx",
    "apps/control/app/(shell)/dashboard/studio/sync-studio-frame.tsx",
    "apps/control/app/(shell)/dashboard/studio/sync-studio-frame.module.css",
    "apps/control/app/sync-source.css",
    "apps/control/app/sync-adapter.css",
    "tests/control/sync-retained-studio-surfaces.spec.ts"
  ];
  writeFileSync(join(artifactDirectory, "case-readback.json"), JSON.stringify({
    schemaVersion: 1,
    scope: "Actual retained component/CSS and controlled action-transport checks. No authenticated-route, provider, database, Sourcepixel or whole-product acceptance claim.",
    sourceHashes: Object.fromEntries(paths.map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
    results: readbacks
  }, null, 2) + "\n");
});

type Command = { action: string; input: Record<string, unknown> };
async function mount(page: Page, mode: "actions" | "generic" | "sync", options: { viewer?: boolean; rejectFirst?: boolean; dropFirstSave?: boolean } = {}) {
  const document = mode === "sync" ? createSyncStudioStarter({ family: "fixtures", tenantName: "Eigen QA-club" }) : createEmptyStudioDocument();
  const historicalDocument = structuredClone(document);
  const historyBefore = JSON.stringify(historicalDocument);
  const state = { document, revision: 7, commits: 0 };
  const commands: Command[] = [], errors: string[] = [];
  const receipts = new Map<string, unknown>();
  const revision = { id: revisionId, number: 3, draftRevision: 3, document: historicalDocument, createdAt: "2026-10-19T01:00:00Z", createdBy: null, createdByName: "Eigen QA-actor", reason: "checkpoint" };
  const permissions = { canArchive: !options.viewer, canCreate: !options.viewer, canEdit: !options.viewer, canManageBrand: !options.viewer, canManageJobs: !options.viewer, canManageTemplate: !options.viewer, canRender: !options.viewer };
  const project = { id: projectId, name: "Eigen bestaand ontwerp", document, draftRevision: 7, projectRevision: 9, createdAt: "2026-10-19T01:00:00Z", updatedAt: "2026-10-19T01:00:00Z", ownerUserId: null, kind: "design", status: "active", orientation: "landscape", motionEnabled: false, durationMs: 10_000, lastExportMediaId: null, lastRenderStatus: null };
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css"]
    .flatMap(path => { try { return [readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")]; } catch (error) { if (path.endsWith("sync-retained-studio.css") && (error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" });
  });
  await page.route(`${origin}/__retained-studio/*`, route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const input = route.request().postDataJSON() as Record<string, unknown>;
    commands.push({ action, input });
    if (action === "readSyncStudioDraft") return route.fulfill({ json: { ok: true, document: state.document, revision: state.revision } });
    if (options.rejectFirst && commands.length === 1) return route.fulfill({ json: { ok: false, outcome: "conflict", error: "Een nieuwere versie blokkeert deze wijziging. Je invoer blijft behouden; controleer de actuele versie." } });
    const key = String(input.idempotencyKey);
    let receipt = receipts.get(key);
    if (!receipt) {
      state.commits++;
      if (action === "saveStudioDraft") { state.document = structuredClone(input.document as StudioDocument); state.revision++; }
      if (action === "restoreStudioRevision") { state.document = structuredClone(historicalDocument); state.revision++; }
      receipt = { ok: true, outcome: action === "saveStudioDraft" ? "saved" : "restored", revision: state.revision };
      receipts.set(key, receipt);
    }
    if (options.dropFirstSave && action === "saveStudioDraft" && commands.filter(command => command.action === action).length === 1) return route.abort();
    return route.fulfill({ json: receipt });
  });
  await page.route(`${origin}/__fixture*`, route => {
    const props = mode === "actions" ? { canArchive: !options.viewer, canEdit: !options.viewer, canMutate: !options.viewer, project } : { assets: [], error: null, initialRenderId: null, isLive: true, permissions, project: { ...project, document: state.document, draftRevision: state.revision }, renderJobs: [], revisions: [revision], tenantId };
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio-controle</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify(props).replace(/</g, "\\u003c")};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(`${origin}/__fixture?mode=${mode}`);
  await expect(page.getByRole("heading", { name: "Eigen Studio-controle", exact: true })).toBeVisible();
  await page.evaluate(() => window.document.fonts.ready);
  return { state, commands, errors, historyUnchanged: () => expect(JSON.stringify(historicalDocument)).toBe(historyBefore) };
}

async function readableControl(control: Locator) {
  await expect(control).toHaveCSS("font-size", "14px");
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
}

async function capture(page: Page, id: string, scope: Locator) {
  const selector = await scope.evaluate(element => element.matches("[data-floating-panel]") ? "[data-floating-panel]" : element.matches(".vc-studio-properties") ? ".vc-studio-properties" : "[role=dialog]");
  const violations = (await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
  expect(violations).toEqual([]);
  // Existing FloatingPanel ResizeObserver placement needs a committed layout
  // before the descriptor and its screenshot sample the same visible surface.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const geometry = await scope.evaluate(element => { const box = element.getBoundingClientRect(), css = getComputedStyle(element); return { x: box.x, y: box.y, width: box.width, height: box.height, font: css.fontFamily, background: css.backgroundColor }; });
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.x + geometry.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  let screenshot: string | undefined;
  if (artifactDirectory) { mkdirSync(artifactDirectory, { recursive: true }); screenshot = join(artifactDirectory, `${id}.png`); await page.screenshot({ path: screenshot, fullPage: true }); }
  readbacks.push({ id, status: "PASS", geometry, axeViolations: violations.length, screenshot, screenshotSha256: screenshot ? createHash("sha256").update(readFileSync(screenshot)).digest("hex") : undefined });
}

for (const width of [390, 1440]) {
  test(`retained rename body portal preserves keyboard, guarded payload and readable Source form at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await mount(page, "actions", { rejectFirst: true });
    const trigger = page.getByRole("button", { name: "Acties voor Eigen bestaand ontwerp", exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    const panel = page.locator("[data-floating-panel]");
    await expect(panel.getByRole("button", { name: "Hernoemen", exact: true })).toBeFocused();
    expect(await panel.evaluate(element => element.parentElement === document.body)).toBe(true);
    await panel.getByRole("button", { name: "Hernoemen", exact: true }).click();
    const input = panel.getByLabel("Nieuwe ontwerpnaam", { exact: true });
    const save = panel.getByRole("button", { name: "Opslaan", exact: true });
    await readableControl(input); await readableControl(save);
    await expect(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(save).toHaveCSS("background-color", "rgb(0, 109, 115)");
    await expect(save).toHaveCSS("color", "rgb(255, 255, 255)");
    await input.fill("Mijn nieuwe ontwerpnaam");
    await save.focus(); await page.keyboard.press("Enter");
    await expect(panel.getByRole("alert")).toContainText("invoer blijft behouden");
    await expect(input).toHaveValue("Mijn nieuwe ontwerpnaam");
    expect(fixture.commands).toHaveLength(1);
    expect(fixture.commands[0]).toMatchObject({ action: "mutateStudioProject", input: { projectId, expectedRevision: 9, operation: "rename", payload: { name: "Mijn nieuwe ontwerpnaam" } } });
    expect(fixture.commands[0]!.input.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
    await capture(page, `rename-${width}`, panel);
    await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(fixture.commands).toHaveLength(1); expect(fixture.errors).toEqual([]);
  });

  test(`generic revision body portal preserves immutable restore and Escape at ${width}`, async ({ page }) => {
    // The retained generic editor only exposes this trigger on desktop. Resize
    // an actually opened dialog for mobile presentation; do not invent access.
    await page.setViewportSize({ width: 1440, height: 900 });
    const fixture = await mount(page, "generic", { rejectFirst: true });
    const trigger = page.getByRole("button", { name: "Revisiegeschiedenis openen", exact: true }).filter({ visible: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Revisiegeschiedenis", exact: true });
    await expect(dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeFocused();
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate(element => element.parentElement?.parentElement === document.body)).toBe(true);
    await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const checkpoint = dialog.getByRole("button", { name: /Revisie 3/ });
    await checkpoint.click();
    const checkpointBox = await checkpoint.boundingBox();
    expect(checkpointBox).not.toBeNull();
    expect(checkpointBox!.height).toBeGreaterThanOrEqual(44);
    expect(checkpointBox!.height).toBeLessThanOrEqual(120);
    const restore = dialog.getByRole("button", { name: "Als nieuw concept herstellen", exact: true });
    await readableControl(restore); await expect(restore).toHaveCSS("background-color", "rgb(0, 109, 115)");
    await restore.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Er is een nieuwere serverversie", { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible(); fixture.historyUnchanged();
    await capture(page, `revisions-${width}`, dialog);
    await restore.click(); await expect(dialog).toHaveCount(0);
    expect(fixture.commands).toHaveLength(2);
    for (const command of fixture.commands) expect(command).toMatchObject({ action: "restoreStudioRevision", input: { expectedDraftRevision: 7, projectId, revisionId } });
    expect(fixture.commands[0]!.input.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
    expect(fixture.state.commits).toBe(1); fixture.historyUnchanged();
    await page.setViewportSize({ width: 1440, height: 900 });
    await trigger.click(); await expect(dialog).toBeVisible();
    await page.setViewportSize({ width, height: 900 });
    await dialog.getByRole("button", { name: /Revisie 3/ }).click();
    await expect(dialog.getByText("Huidig concept: revisie 8", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    expect(fixture.commands).toHaveLength(2); expect(fixture.errors).toEqual([]);
  });

  test(`saved Sync properties remain readable and retain an uncertain save command at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await mount(page, "sync", { dropFirstSave: true });
    const properties = page.locator(".vc-studio-properties");
    const title = properties.getByLabel("Titel op het scherm", { exact: true });
    const heading = properties.getByLabel("Boventitel", { exact: true });
    await readableControl(title); await readableControl(heading);
    await expect(properties.locator("label").filter({ has: page.getByRole("textbox", { name: "Titel op het scherm", exact: true }) })).toHaveCSS("font-size", "14px");
    await expect(properties.locator(".vc-properties-heading p")).toHaveCSS("font-size", "14px");
    const canvasBefore = await page.locator(".vc-studio-stage").screenshot();
    await capture(page, `properties-${width}`, properties);
    await title.fill("Mijn leesbare schermtitel");
    await page.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dezelfde wijziging bevestigen", exact: true })).toBeVisible();
    expect(fixture.commands.filter(command => command.action === "saveStudioDraft")).toHaveLength(1);
    const first = fixture.commands.find(command => command.action === "saveStudioDraft")!;
    expect(first.input).toMatchObject({ projectId, expectedRevision: 7 });
    expect((first.input.document as StudioDocument).syncPresentation!.title).toBe("Mijn leesbare schermtitel");
    await page.getByRole("button", { name: "Dezelfde wijziging bevestigen", exact: true }).click();
    await expect(page.getByText("Versie 8 is veilig opgeslagen.", { exact: true })).toBeVisible();
    expect(fixture.commands.filter(command => command.action === "saveStudioDraft")).toEqual([first, first]);
    expect(fixture.state.commits).toBe(1); fixture.historyUnchanged();
    expect(canvasBefore.length).toBeGreaterThan(100); expect(fixture.errors).toEqual([]);
  });
}

test("generic history opens directly on mobile and preserves read-only restore permissions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const fixture = await mount(page, "generic", { viewer: true });
  const trigger = page.getByRole("button", { name: "Revisiegeschiedenis openen", exact: true }).filter({ visible: true });
  await readableControl(trigger);
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Revisiegeschiedenis", exact: true });
  await expect(dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: /Revisie 3/ }).click();
  await expect(dialog.getByRole("button", { name: "Als nieuw concept herstellen", exact: true })).toBeDisabled();
  await capture(page, "mobile-history-readonly-390", dialog);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  expect(fixture.commands).toEqual([]); fixture.historyUnchanged(); expect(fixture.errors).toEqual([]);
});

test("read-only retained cards expose no mutation action", async ({ page }) => {
  const fixture = await mount(page, "actions", { viewer: true });
  await expect(page.getByRole("button", { name: "Acties voor Eigen bestaand ontwerp", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bekijken", exact: true })).toHaveAttribute("href", `/dashboard/studio/${projectId}`);
  expect(fixture.commands).toEqual([]); expect(fixture.errors).toEqual([]);
});


for (const width of [390, 1440]) {
  test(`saved Studio properties keep every tab and output action inside the panel at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await mount(page, "sync");
    const properties = page.locator(".vc-studio-properties");
    const rows = [];
    for (const tab of ["Inhoud", "Vormgeving", "Gegevensbron", "Instellingen"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(properties).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      rows.push(await properties.evaluate((element, tab) => ({
        tab,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        text: element.textContent,
      }), tab));
    }
    const output = properties.locator("section.vc-source-binding");
    await expect(output.getByText("Schermvoorbeeld", { exact: true })).toBeVisible();
    await expect(output.getByText("Maak na het opslaan de uitvoer voor je bibliotheek.", { exact: true })).toBeVisible();
    const actions = [output.getByRole("button", { name: "Schermvoorbeeld maken", exact: true }), output.getByRole("link", { name: "Naar de bibliotheek", exact: true })];
    for (const action of actions) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeVisible();
      await expect(action).toBeInViewport();
    }
    const geometry = await output.evaluate(element => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      actions: [...element.querySelectorAll("button,a")].map(action => {
        const r = action.getBoundingClientRect(), p = element.getBoundingClientRect();
        return { name: action.textContent, left: r.left - p.left, right: r.right - p.left, height: r.height };
      })
    }));
    await testInfo.attach("properties-layout.json", { body: JSON.stringify({ width, rows, geometry }), contentType: "application/json" });
    await testInfo.attach("properties-output.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(rows.map(row => ({ tab: row.tab, excess: row.scrollWidth - row.clientWidth }))).toEqual(["Inhoud", "Vormgeving", "Gegevensbron", "Instellingen"].map(tab => ({ tab, excess: 0 })));
    expect(geometry.scrollWidth).toBe(geometry.width);
    for (const action of geometry.actions) {
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeLessThanOrEqual(geometry.width + 2);
      expect(action.height).toBeGreaterThanOrEqual(44);
    }
    expect(fixture.commands).toEqual([]);
    expect(fixture.errors).toEqual([]);
    fixture.historyUnchanged();
  });
}
