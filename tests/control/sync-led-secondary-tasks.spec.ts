import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Actual route, wizard, retained editors, forms and CSS. The session/readmodel
// and command transports are controlled; no live Auth/RLS/write proof follows.
// The absent sidebar is isolated with display:block; the actual shell height and
// .vx-main inner scroller remain, with a stretched main replacing grid stretch.
const origin = "http://127.0.0.1:3348";
const path = "/dashboard/studio/led-scores";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const id = (n: number) => `24800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const titles = ["Bestaande wedstrijdmomenten", "Uitgebreide overlay-editor", "Live tussenstand als slide", "Uitleg en clubhuisstijl"];
// Existing editor maxLength and server readGoalDesign both permit 80 characters.
const longPreviewHeadline = "Een prachtig doelpunt voor onze club: samen vieren we deze verdiende voorsprong!";
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React from'react';import{createRoot}from'react-dom/client';import Page from'./apps/control/app/(shell)/dashboard/studio/led-scores/page';import{createRoyalCurrentAppearance,createRoyalCurrentSelection,createRoyalCurrentTheme,themeCatalog}from'@veyocast/content-templates';import{freezeThemePresentation}from'@veyocast/content-templates/theme-catalog';const style={primary:'#2459ed'},appearance=createRoyalCurrentAppearance(style),selection=createRoyalCurrentSelection(style,themeCatalog.fieldflow.version,'light');globalThis.fixture.style={appearance,selection,light:createRoyalCurrentTheme(style,'light'),dark:createRoyalCurrentTheme(style,'dark'),error:null,revision:1,presentation:freezeThemePresentation({appearance,selection,instant:'2026-10-19T12:00:00Z',settingsRevision:1,timezone:'Europe/Amsterdam'})};const root=createRoot(document.getElementById('root'));async function render(suffix){if(suffix!==undefined)history.pushState(null,'','/dashboard/studio/led-scores'+suffix);const params=Object.fromEntries(new URLSearchParams(location.search));const content=await Page({searchParams:Promise.resolve(params)});root.render(<div className='sites-control vx-shell app-shell design-sync sync-control' style={{display:'block'}}><main className='vx-main app-body' style={{height:'100%'}}><div id='control-content' className='vx-content main-content'>{content}</div></main></div>)}globalThis.rerenderLedPage=render;render().catch(error=>{setTimeout(()=>{throw error})});`;
  const actionNames = ["saveLedScoresGoalAlert", "publishLedScoresGoalAlert", "setLedScoresGoalAlertStatus", "testLedScoresGoalAlert", "createLedScoresLiveMatchSlide", "saveSitesLedMoment", "prepareSitesSourceDestination", "cancelMediaVideoUpload", "finalizeMediaVideoUpload", "prepareMediaVideoUpload"];
  const actions = actionNames.map(name => `export async function ${name}(...args){globalThis.commands.push({kind:${JSON.stringify(name)},input:args.map(value=>value instanceof FormData?Array.from(value.entries()):value)});throw Error('Unexpected command in readonly presentation test')}`).join(";");
  const script = String.raw`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'led-page.js',platform:'browser',external:['/onzetrots-tv/*'],format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},plugins:[{name:'controlled-session-readmodel-command-transport',setup(b){const mock=(path,contents)=>({path,namespace:'fixture',pluginData:{contents}});b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>mock(a.path,a.path.endsWith('navigation')?'export const useRouter=()=>({refresh(){},push:path=>location.assign(path)});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);':'import React from"react";export default function Host({children,priority,unoptimized,fill,...props}){return React.createElement('+JSON.stringify(a.path.endsWith('image')?'img':'a')+',props,children)}'));b.onResolve({filter:/^node:crypto$/},a=>mock(a.path,'export const randomUUID=()=>globalThis.crypto.randomUUID()'));b.onResolve({filter:/control-session$/},a=>mock(a.path,'export async function requireTenantControlSession(capability){if(capability!=="tenant.dynamic_slide.read")throw Error("Unexpected capability");return globalThis.fixture.session}'));b.onResolve({filter:/tenant-style-data$/},a=>mock(a.path,'export async function loadTenantStyleData(){return globalThis.fixture.style}'));b.onResolve({filter:/supabase\/config$/},a=>mock(a.path,'export const getSupabasePublicConfig=()=>null'));b.onResolve({filter:/studio-data$/},a=>mock(a.path,'export async function loadStudioData(){return globalThis.fixture.data};export function emptyData(){return globalThis.fixture.emptyData}'));b.onResolve({filter:/sites-source-destination-data$/},a=>mock(a.path,'export async function loadSitesSourceDestinationOptions(){return globalThis.fixture.destinations}'));b.onResolve({filter:/(?:^|\/)(?:sites-led-moment-|sites-source-destination-)?actions$/},a=>mock(a.path,${JSON.stringify(actions)}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.pluginData.contents,loader:'js',resolveDir:process.cwd()}))}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }));
});

function fixture(variant = "owner") {
  const connection = { id: id(3), name: "Eigen scorebord", provider_club_id: "own", provider_club_name: "Eigen club", catalog_synced_at: "2026-10-19T12:00:00Z", liveState: { home: { name: "Eigen club", score: 2 }, away: { name: "Gasten", score: 1 }, sourceUpdatedAt: "2026-10-19T12:00:00Z", clockSeconds: 4044 } };
  const alert = { id: id(1), connection_id: connection.id, name: "Eigen bestaande experience", status: "draft", priority: 100, duration_ms: 8000, underlay_policy: "continue", draft_config: { schemaVersion: 1, triggerOwn: true, triggerOpponent: false, ...(variant === "long-headline" ? { ownDesign: { headline: longPreviewHeadline } } : {}) }, revision: 7, current_published_version_id: null as string | null, updated_at: "2026-10-19T12:00:00Z", is_central_goal_overlay: false };
  const data = { alerts: [alert, { ...alert, id: id(4), name: "Eigen gepubliceerde experience", status: "published", current_published_version_id: id(40) }, { ...alert, id: id(5), name: "Eigen centrale Goal Overlay", is_central_goal_overlay: true }], assets: [], availability: variant === "feature-off" ? "not_released" : "available", enabled: variant !== "feature-off", connections: variant === "no-connection" ? [] : [connection], draftGroups: [{ alert_id: alert.id, screen_group_id: id(20) }], groups: [{ id: id(20), name: "Eigen schermgroep", screenIds: [id(30)] }], liveSlides: [{ id: id(10), name: "Eigen live wedstrijdslide", orientation: "landscape", status: "draft", updated_at: alert.updated_at }], mappings: [], publishedGroups: [{ alert_version_id: id(40), screen_group_id: id(20) }], screens: [{ id: id(30), name: "Eigen kantine", status: "online" }], sponsors: [], targetGroups: [{ id: id(20), screenIds: [id(30)] }] };
  return { session: { isLive: true, tenantId: id(100), tenant: "Eigen vereniging", tenantStatus: variant === "paused" ? "paused" : "active", capabilities: variant === "viewer" ? ["tenant.dynamic_slide.read"] : ["tenant.dynamic_slide.read", "tenant.dynamic_slide.write", "tenant.playlist.publish"], timezoneName: "Europe/Amsterdam" }, data, emptyData: { ...data, enabled: false, availability: "not_released", alerts: [], connections: [] }, destinations: { canPublish: false, unavailable: false, playlists: [], screens: [], groups: [] } };
}

for (const width of [390, 1440]) {
  test(`retained goal preview preserves full server headline scorer and score without overlap at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const state = await prepare(page);
    expect(longPreviewHeadline.length).toBe(80);
    for (const [variant, headline] of [["owner", "GOOOAAAL!"], ["long-headline", longPreviewHeadline]]) {
      await visit(page, `?edit=${id(1)}&fixture=${variant}#editor`);
      const serverBefore = await page.evaluate(() => JSON.stringify((globalThis as unknown as { fixture: { data: unknown } }).fixture.data));
      await expect(page.locator('#editor input[name="name"]')).toHaveValue("Eigen bestaande experience");
      await expect(page.locator('#editor input[name="expectedRevision"]')).toHaveValue("7");
      const preview = page.locator('#editor [data-orientation][data-palette][data-typography]');
      await expect(preview).toHaveCount(1);
      const stand = page.locator("#editor").getByRole("group", { name: "Schermstand", exact: true });
      for (const [orientation, label] of [["landscape", "16:9"], ["portrait", "9:16"]]) {
        await stand.getByRole("button", { name: label, exact: true }).click();
        await expect(preview).toHaveAttribute("data-orientation", orientation!);
        await preview.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const sample = await preview.evaluate(node => {
          const root = node as HTMLElement;
          const goal = root.querySelector<HTMLElement>("[data-show-scorer]")!;
          const title = goal.querySelector<HTMLElement>(":scope > div > strong")!;
          const scorer = goal.querySelector<HTMLElement>(":scope > div > p")!;
          const portrait = goal.querySelector<HTMLElement>(":scope > span:first-child")!;
          const score = goal.querySelector<HTMLElement>(":scope > span:last-child")!;
          const rect = (element: HTMLElement) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { x: box.x, y: box.y, left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, fontSize: style.fontSize, textOverflow: style.textOverflow, overflow: style.overflow };
          };
          const textRects = (element: HTMLElement) => {
            const text = document.createRange(); text.selectNodeContents(element);
            return [...text.getClientRects()].map(box => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom }));
          };
          return { preview: rect(root), goal: rect(goal), assignedGoalStageHeight: parseFloat(getComputedStyle(root).gridTemplateRows.split(/\s+/)[1]!), goalStageSubpixelToleranceCssPixels: 1, title: rect(title), scorer: rect(scorer), portrait: rect(portrait), score: rect(score), titleTextRects: textRects(title), scorerTextRects: textRects(scorer), scoreTextRects: textRects(score), headline: title.textContent, scorerText: scorer.textContent, scoreText: score.textContent, orientation: root.dataset.orientation, palette: root.dataset.palette };
        });
        const key = `goal-preview-${width}-${variant}-${orientation}`;
        await record(info, key, sample); await record(info, key + "-native", await preview.screenshot());
        expect(Math.abs(sample.goal.height - sample.assignedGoalStageHeight)).toBeLessThanOrEqual(1);
        expect(sample.headline).toBe(headline); expect(sample.scorerText).toBe("#9 D. Jansen"); expect(sample.scoreText).toBe("4–2");
        for (const rect of [sample.title, sample.scorer, sample.portrait, sample.score, ...sample.titleTextRects, ...sample.scorerTextRects, ...sample.scoreTextRects]) {
          expect(rect.left).toBeGreaterThanOrEqual(sample.preview.left); expect(rect.right).toBeLessThanOrEqual(sample.preview.right);
          expect(rect.top).toBeGreaterThanOrEqual(sample.preview.top); expect(rect.bottom).toBeLessThanOrEqual(sample.preview.bottom);
        }
        type Edges = Pick<typeof sample.title, "left" | "right" | "top" | "bottom">;
        const disjoint = (a: Edges, b: Edges) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
        expect(disjoint(sample.title, sample.score)).toBe(true); expect(disjoint(sample.title, sample.scorer)).toBe(true); expect(disjoint(sample.portrait, sample.score)).toBe(true);
        for (const title of sample.titleTextRects) for (const other of [...sample.scorerTextRects, ...sample.scoreTextRects]) expect(disjoint(title, other)).toBe(true);
        for (const scorer of sample.scorerTextRects) for (const score of sample.scoreTextRects) expect(disjoint(scorer, score)).toBe(true);
        expect(sample.title.scrollWidth).toBeLessThanOrEqual(sample.title.clientWidth); expect(sample.title.scrollHeight).toBeLessThanOrEqual(sample.title.clientHeight);
        expect(sample.title.textOverflow).not.toBe("ellipsis");
        expect(await page.evaluate(() => JSON.stringify((globalThis as unknown as { fixture: { data: unknown } }).fixture.data))).toBe(serverBefore);
        expect(await page.evaluate(() => (globalThis as unknown as { commands: unknown[] }).commands)).toEqual([]);
      }
    }
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
  });
}

async function record(info: TestInfo, name: string, value: Buffer | object) {
  const png = Buffer.isBuffer(value), file = info.outputPath(`${name}.${png ? "png" : "json"}`);
  writeFileSync(file, png ? value : JSON.stringify(value, null, 2));
  await info.attach(name, { path: file, contentType: png ? "image/png" : "application/json" });
}

async function prepare(page: Page) {
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"].map(name => readFileSync(name, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.abort();
    if (url.pathname === path) {
      const data = fixture(url.searchParams.get("fixture") ?? "owner");
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LED-taken · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data)};globalThis.commands=[];</script><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
    }
    if (/^\/(?:assets|fieldflow|onzetrots|onzetrots-tv)\/[a-zA-Z0-9_./-]+$/.test(url.pathname) && !url.pathname.split("/").includes("..")) {
      const file = join(process.cwd(), "apps/control/public", url.pathname);
      return route.fulfill({ body: readFileSync(file), contentType: file.endsWith("woff2") ? "font/woff2" : file.endsWith("ttf") ? "font/ttf" : file.endsWith("svg") ? "image/svg+xml" : file.endsWith("webp") ? "image/webp" : "image/png" });
    }
    return route.abort();
  });
  return { errors, writes };
}

async function visit(page: Page, suffix = "") {
  await page.goto(`${origin}${path}${suffix}`);
  await expect(page.locator("#control-content h1").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function rerender(page: Page, suffix: string) {
  await page.evaluate(async suffix => {
    await (globalThis as unknown as { rerenderLedPage: (suffix: string) => Promise<void> }).rerenderLedPage(suffix);
  }, suffix);
}

async function editorGeometry(page: Page) {
  return page.evaluate(() => {
    const containers = [...document.querySelectorAll<HTMLElement>(".vx-main,#control-content")].map(node => ({ selector: node.id || node.className, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }));
    const boundary = document.querySelector("#control-content")!.getBoundingClientRect();
    const overflow = [...document.querySelectorAll<HTMLElement>("#editor,#editor *")].flatMap(node => {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      return rect.width > 0 && (rect.right > boundary.right + 1 || node.scrollWidth > node.clientWidth + 1) ? [{ tag: node.tagName, className: node.className, text: node.textContent?.trim().slice(0, 100), x: rect.x, width: rect.width, right: rect.right, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, display: css.display, minWidth: css.minWidth, maxWidth: css.maxWidth, whiteSpace: css.whiteSpace, gridTemplateColumns: css.gridTemplateColumns }] : [];
    });
    return { containers, overflow };
  });
}

async function readback(page: Page) {
  return page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, viewport: innerWidth, innerScroll: [...document.querySelectorAll(".vx-main, #control-content")].map(node => { const element = node as HTMLElement; return { selector: element.id ? `#${element.id}` : ".vx-main", clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollTop: element.scrollTop, overflowY: getComputedStyle(element).overflowY }; }), sections: [...document.querySelectorAll("details[data-led-secondary]")].map(node => { const d = node as HTMLDetailsElement, summary = d.querySelector("summary")!, box = summary.getBoundingClientRect(); return { kind: d.dataset.ledSecondary, open: d.open, title: summary.textContent?.trim(), y: box.y, height: box.height, width: box.width, fontSize: getComputedStyle(summary).fontSize }; }), forms: [...document.querySelectorAll("form")].map(node => ({ id: node.closest("section[id]")?.id, fields: [...new FormData(node)].map(([key, value]) => [key, String(value)]) })) }));
}

for (const width of [390, 1440]) {
  test(`actual LED page keeps Source primary and secondary drafts at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const state = await prepare(page); await visit(page);
    await record(info, `default-readback-${width}`, await readback(page));
    await record(info, `default-native-${width}`, await page.screenshot({ fullPage: true }));
    await expect(page.getByRole("navigation", { name: "LED Scores ontwerpstappen", exact: true })).toBeVisible();
    const disclosures = page.locator("details[data-led-secondary]"); await expect(disclosures).toHaveCount(4);
    for (const [index, title] of titles.entries()) await expect(disclosures.nth(index).locator(":scope > summary")).toContainText(title);
    await expect(page.locator("#editor")).toHaveCount(1); await expect(page.locator("#editor")).not.toBeVisible();
    await expect(page.locator("#live-score-slide")).toHaveCount(1); await expect(page.locator("#live-score-slide")).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Goal Overlay beheren", exact: true })).toHaveAttribute("href", `${path}/goal-overlay`);
    await disclosures.last().locator(":scope > summary").scrollIntoViewIfNeeded();
    await record(info, `collapsed-secondary-native-${width}`, await page.screenshot());
    const sourceName = page.getByLabel("Naam van je ontwerp", { exact: true }); await sourceName.fill("Eigen nieuw Sourceconcept");
    for (const section of await disclosures.all()) {
      const summary = section.locator(":scope > summary"); await expect(summary).toHaveCSS("font-size", "14px");
      const box = (await summary.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
      await summary.focus(); await page.keyboard.press("Enter"); await expect(section).toHaveAttribute("open", "");
      await record(info, `opened-${await section.getAttribute("data-led-secondary")}-${width}`, await page.screenshot());
      await page.keyboard.press("Tab"); expect(await section.evaluate(node => node.contains(document.activeElement))).toBe(true);
      await summary.focus(); await page.keyboard.press("Space"); await expect(section).not.toHaveAttribute("open", ""); await expect(summary).toBeFocused();
    }
    for (const [kind, selector, value] of [["editor", '#editor input[name="name"]', "Eigen overlaydraft"], ["live-score", '#live-score-slide input[name="name"]', "Eigen live-slidedraft"]]) {
      const disclosure = page.locator(`details[data-led-secondary="${kind}"]`), summary = disclosure.locator(":scope > summary");
      await summary.click(); await page.locator(selector).fill(value); const before = await readback(page);
      await summary.click(); await summary.click(); await expect(page.locator(selector)).toHaveValue(value);
      expect((await readback(page)).forms).toEqual(before.forms);
      await summary.click();
    }
    await expect(sourceName).toHaveValue("Eigen nieuw Sourceconcept");
    const axe = await new AxeBuilder({ page }).include("details[data-led-secondary] > summary").withRules(["color-contrast", "target-size"]).analyze();
    await record(info, `targeted-axe-${width}`, { violations: axe.violations, incomplete: axe.incomplete }); expect(axe.violations).toEqual([]); expect(axe.incomplete).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll(".vx-main,#control-content")].every(node => node.scrollWidth <= node.clientWidth))).toBe(true);
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]); expect(await page.evaluate(() => (globalThis as unknown as { commands: unknown[] }).commands)).toEqual([]);
  });

  test(`actual LED edit hashes error returns and reader guards remain reachable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); const state = await prepare(page);
    await visit(page, `?edit=${id(1)}#editor`); await record(info, `edited-readback-${width}`, await readback(page)); await record(info, `edited-native-${width}`, await page.screenshot());
    const editor = page.locator('details[data-led-secondary="editor"]'); await expect(editor).toHaveAttribute("open", "");
    await expect(page.getByRole("navigation", { name: "LED Scores ontwerpstappen", exact: true })).toHaveCount(0);
    await expect(page.locator('#editor input[name="name"]')).toHaveValue("Eigen bestaande experience"); await expect(page.locator('#editor input[name="expectedRevision"]')).toHaveValue("7"); await expect(page.locator('#editor input[name="alertId"]')).toHaveValue(id(1));
    expect(await page.locator("details[data-led-secondary]").first().getAttribute("data-led-secondary")).toBe("editor");
    await expect(editor.locator(":scope > summary")).toBeFocused();
    const geometry = await editorGeometry(page); await record(info, `edited-geometry-${width}`, geometry);
    for (const container of geometry.containers) expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    const editName = page.locator('#editor input[name="name"]'); await editName.scrollIntoViewIfNeeded();
    const inputBox = (await editName.boundingBox())!; expect(inputBox.x).toBeGreaterThanOrEqual(0); expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(width);
    const currentStep = page.getByRole("navigation", { name: "Stappen voor wedstrijdmomenten", exact: true }).locator('[aria-current="step"]');
    await expect(currentStep).toBeVisible(); await currentStep.scrollIntoViewIfNeeded();
    const stepBox = (await currentStep.boundingBox())!; expect(stepBox.x).toBeGreaterThanOrEqual(0); expect(stepBox.x + stepBox.width).toBeLessThanOrEqual(width);
    await editor.locator(":scope > summary").click();
    await expect(editor).not.toHaveAttribute("open", "");
    const liveDisclosure = page.locator('details[data-led-secondary="live-score"]');
    await liveDisclosure.locator(":scope > summary").click();
    const liveDraft = page.locator('#live-score-slide input[name="name"]');
    await liveDraft.fill("Eigen liveconcept bij navigatie");
    const retainedLiveNode = await liveDraft.elementHandle();
    await liveDisclosure.locator(":scope > summary").click();
    await rerender(page, `?edit=${id(4)}#editor`);
    await expect(editor).toHaveAttribute("open", "");
    await expect(page.locator('#editor input[name="name"]')).toHaveValue("Eigen gepubliceerde experience");
    await expect(page.locator('#editor input[name="alertId"]')).toHaveValue(id(4));
    expect(await retainedLiveNode!.evaluate(node => node.isConnected)).toBe(true);
    await expect(liveDraft).toHaveValue("Eigen liveconcept bij navigatie");
    await expect(editor.locator(":scope > summary")).toBeFocused();
    await visit(page, "#editor"); await expect(page.locator("#editor")).toBeVisible();
    await editor.locator(":scope > summary").click(); await expect(page.locator("#editor")).not.toBeVisible();
    const help = page.locator('details[data-led-secondary="help"]'); await help.locator(":scope > summary").click();
    await help.getByRole("link", { name: "Overlay experience maken", exact: true }).click(); await expect(page.locator("#editor")).toBeVisible();
    await page.evaluate(() => { location.hash = "live-score-slide"; }); await expect(page.locator("#live-score-slide")).toBeVisible();
    await visit(page, "#live-score-slide"); await expect(page.locator("#live-score-slide")).toBeVisible();
    await rerender(page, "?fout=Eigen%20native%20fout"); await expect(page.getByRole("alert")).toContainText("Eigen native fout");
    for (const kind of ["management", "editor", "live-score"]) await expect(page.locator(`details[data-led-secondary="${kind}"]`)).toHaveAttribute("open", "");
    await page.locator('details[data-led-secondary="management"] > summary').click();
    await expect(page.locator('details[data-led-secondary="management"]')).not.toHaveAttribute("open", "");
    await rerender(page, `?succes=Eigen%20bevestiging&resultaat=${id(50)}`); await expect(page.getByRole("status")).toContainText("Eigen bevestiging"); await expect(page.locator('details[data-led-secondary="management"]')).toHaveAttribute("open", ""); await expect(page.getByRole("link", { name: "Bekijk het afleverresultaat per scherm", exact: true })).toHaveAttribute("href", `/dashboard/data-sources/led-scores#event-${id(50)}`);
    await visit(page, `?edit=${id(999)}`); await expect(page.getByRole("navigation", { name: "LED Scores ontwerpstappen", exact: true })).toBeVisible(); await expect(page.locator('details[data-led-secondary="editor"]')).not.toHaveAttribute("open", "");
    for (const variant of ["viewer", "paused"]) { await visit(page, `?fixture=${variant}`); await expect(page.locator('details[data-led-secondary="management"]')).toHaveAttribute("open", ""); await expect(page.locator("#editor,#live-score-slide")).toHaveCount(0); await expect(page.locator("form")).toHaveCount(0); await expect(page.getByRole("navigation", { name: "LED Scores ontwerpstappen", exact: true })).toHaveCount(0); }
    for (const variant of ["feature-off", "no-connection"]) { await visit(page, `?fixture=${variant}`); await expect(page.locator("details[data-led-secondary]")).toHaveCount(0); await expect(page.locator("form")).toHaveCount(0); await expect(page.getByRole("status")).toContainText(variant === "no-connection" ? "Eerst een databron koppelen" : "Niet vrijgegeven voor deze tenant."); }
    await record(info, `last-boundary-${width}`, await readback(page)); expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    expect(await page.evaluate(() => (globalThis as unknown as { commands: unknown[] }).commands)).toEqual([]);
  });
}
