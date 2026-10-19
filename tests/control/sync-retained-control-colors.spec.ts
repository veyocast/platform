import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

// Actual audit page, TenantThemeEditor/EditorialThemeEditor and production CSS.
// Only the audit session/readmodel is controlled; no Auth/RLS/save proof follows.
const origin = "http://127.0.0.1:3347";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const rootStyles = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"];
let audit: { html: string; css: string };
let themeBootstrap: string;
let editor: { js: string; css: string };

function compile(script: string) {
  return execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 });
}

test.beforeAll(() => {
  const serverEntry = `import React from'react';import{renderToReadableStream}from'react-dom/server';import AuditLogPage from'./apps/control/app/(shell)/dashboard/auditlog/page';import{ControlThemeBootstrap}from'./apps/control/app/(shell)/_components/control-theme-switcher';export async function renderAudit(){const page=await AuditLogPage({searchParams:Promise.resolve({})});return await new Response(await renderToReadableStream(<><ControlThemeBootstrap/>{page}</>)).text()}`;
  const serverBuild = String.raw`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(serverEntry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'audit.js',platform:'node',format:'cjs',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl'},plugins:[{name:'audit-read-boundary',setup(b){b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:'fixture',pluginData:{contents:'import React from"react";export default function Link({children,...props}){return React.createElement("a",props,children)}'}}));b.onResolve({filter:/\/lib\/control-session$/},a=>({path:a.path,namespace:'fixture',pluginData:{contents:'export async function requireTenantControlSession(capability){if(capability!=="tenant.audit.read")throw Error("Unexpected capability");return{tenantId:"24700000-0000-4000-8000-000000000001",tenant:"Eigen kleurcontrole",isLive:true}}'}}));b.onResolve({filter:/\/lib\/control-overview$/},a=>({path:a.path,namespace:'fixture',pluginData:{contents:'export async function loadTenantAuditEvents(tenant){if(tenant!=="24700000-0000-4000-8000-000000000001")throw Error("Unexpected tenant");return{error:false,page:1,pageCount:1,timezoneName:"Europe/Amsterdam",total:1,events:[{id:"24700000-0000-4000-8000-000000000002",created_at:"2026-10-19T12:00:00Z",action:"playlist.published",target_type:"playlist",target_id:"24700000-0000-4000-8000-000000000003",target_name:"Eigen programma",actor_name:"Eigen beheerder",result:"success",metadata:{version:7,itemCount:3,commandType:"publish"}}]}}'}}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.pluginData.contents,loader:'js',resolveDir:process.cwd()}))}}]});const m={exports:{}};new Function('require','module','exports',result.outputFiles.find(f=>f.path.endsWith('.js')).text)(require,m,m.exports);const html=await m.exports.renderAudit();process.stdout.write(JSON.stringify({html,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  audit = JSON.parse(compile(serverBuild));
  const bootstrap = audit.html.match(/<script>[\s\S]*?<\/script>/)?.[0];
  if (!bootstrap) throw new Error("Actual SSR ControlThemeBootstrap required");
  themeBootstrap = bootstrap; audit.html = audit.html.replace(bootstrap, "");
  if (!audit.html.includes("Commandodetails")) throw new Error("The actual populated audit page is required");
  const browserEntry = `import React from'react';import{createRoot}from'react-dom/client';import{Badge,StatusPill}from'@veyocast/ui';import{TenantThemeEditor}from'./apps/control/app/(shell)/dashboard/settings/tenant-theme-editor';import{createRoyalCurrentAppearance,createRoyalCurrentSelection,createRoyalCurrentTheme,themeCatalog}from'@veyocast/content-templates';const style={primary:'#2459ed'},theme=createRoyalCurrentTheme(style,'light'),selection=createRoyalCurrentSelection(style,themeCatalog.fieldflow.version,'light'),appearance=createRoyalCurrentAppearance(style);globalThis.expectedRetainedThemes={blueLight:theme,blueDark:createRoyalCurrentTheme(style,'dark'),orangeLight:createRoyalCurrentTheme({primary:'#e06a14'},'light')};function App(){const sync=new URL(location.href).searchParams.get('sync')!=='0';return <div className={'sites-control app-shell'+(sync?' sync-control':'')} style={{display:'block',padding:16}}><span data-proof="source-roles" aria-hidden="true" style={{display:'none',color:'var(--accent)',backgroundColor:'var(--accent-soft)',borderColor:'var(--line)'}}/><span data-proof="outside-ink" aria-hidden="true" style={{display:"none",color:"var(--vc-text)"}}/><span data-proof="semantic-status-roles" aria-hidden="true" style={{display:"none",color:"var(--vc-semantic-success-text)",borderColor:"var(--vc-semantic-critical-text)"}}/><main id="control-content"><section data-proof="audit" dangerouslySetInnerHTML={{__html:globalThis.auditMarkup}}/><section data-proof="neutral" aria-label="Neutrale accountstatus"><Badge status="neutral">Eigenaar</Badge><StatusPill label="Eigenaar" tone="neutral"/></section><section data-proof="theme"><h2>Eigen huisstijlcontrole</h2><form onSubmit={e=>{e.preventDefault();throw Error('Unexpected submit')}}><TenantThemeEditor defaults={theme} disabled={false} initialAppearance={appearance} initialSelection={selection} initialTheme={theme}/></form></section><p className="notice notice--critical" data-proof="critical">Bestaande kritieke status blijft herkenbaar.</p></main></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const browserBuild = String.raw`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(browserEntry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'editor.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl'}});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  editor = JSON.parse(compile(browserBuild));
});

async function attach(info: TestInfo, name: string, body: Buffer, contentType: "image/png" | "application/json") {
  const path = info.outputPath(`${name}.${contentType === "image/png" ? "png" : "json"}`);
  writeFileSync(path, body); await info.attach(name, { path, contentType });
}

async function computed(locator: Locator) {
  return locator.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return { label: element.textContent!.trim(), color: style.color, background: style.backgroundColor, border: style.borderColor, shadow: style.boxShadow, fontSize: parseFloat(style.fontSize), width: box.width, height: box.height, selected: element.getAttribute("aria-pressed") ?? element.getAttribute("aria-selected"), swatch: element.querySelector("i") ? getComputedStyle(element.querySelector("i")!).backgroundColor : null };
  }));
}

async function settledFieldChrome(field: Locator) {
  await expect.poll(() => field.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
  return field.evaluate(element => { const style = getComputedStyle(element); return { border: style.borderColor, shadow: style.boxShadow }; });
}

async function themePayload(page: Page) {
  return page.locator('[data-proof="theme"] form').evaluate(form => Object.fromEntries([...new FormData(form as HTMLFormElement)].filter(([name]) => ["themeColorOverridesJson", "themeAppearanceJson", "themeAccent", "themeId", "themeVersion", "themeSupport", "themeModePolicyKind", "themeFixedMode"].includes(name))));
}

async function neutralFacts(page: Page) {
  return page.locator('[data-proof="neutral"] .vc-badge').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect(), dot = element.querySelector(".vc-badge__dot");
    const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i]!, 0);
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return { label: element.textContent!.trim(), color: style.color, background: style.backgroundColor, border: style.border, font: [style.fontSize, style.fontFamily, style.fontWeight], width: rect.width, height: rect.height, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), dot: dot ? { hidden: dot.getAttribute("aria-hidden"), color: getComputedStyle(dot).backgroundColor, width: dot.getBoundingClientRect().width, height: dot.getBoundingClientRect().height } : null };
  }));
}

async function canvasFacts(page: Page) {
  return page.locator('[data-theme-base-scale]').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { html: element.outerHTML, declaration: element.getAttribute("style"), background: style.background, color: style.color, typography: [element.getAttribute("data-theme-base-scale"), element.getAttribute("data-theme-body-font"), element.getAttribute("data-theme-display-font"), element.getAttribute("data-theme-sport-scale")], accent: element.querySelector('[data-theme-setting="baseAccent"]') ? getComputedStyle(element.querySelector('[data-theme-setting="baseAccent"]')!).backgroundColor : null };
  }));
}

async function canvasEditingFacts(page: Page) {
  return page.locator('[data-theme-base-scale]').evaluateAll(elements => elements.map(element => {
    // Real token removal/recovery can reorder CSSStyleDeclaration entries.
    // Keep every property/value and the complete remaining DOM, rather than
    // treating equivalent declaration serialization as a content mutation.
    const copy = element.cloneNode(true) as HTMLElement;
    const nodes = [copy, ...copy.querySelectorAll<HTMLElement>("[style]")];
    const declarations = nodes.map(node => {
      const properties = Object.fromEntries([...node.style].map(name => [name, { value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) }]));
      node.removeAttribute("style"); return properties;
    });
    return { html: copy.outerHTML, declarations };
  }));
}

async function canvasHashes(page: Page, info: TestInfo, stage: string) {
  // Scrolling a screenshot beneath a pointer left on a color field can activate
  // the editor's real onMouseEnter preview highlighting. Compare the same
  // no-hover preview state, without suppressing any product highlight styles.
  await page.mouse.move(0, 0);
  await page.locator('[data-proof="theme"]').evaluate(async element => {
    const fonts = new Set([...element.querySelectorAll('[data-theme-base-scale], [data-theme-base-scale] *')].map(node => { const s = getComputedStyle(node); return `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; }));
    await Promise.all([...fonts].map(font => document.fonts.load(font))); await document.fonts.ready;
  });
  await expect.poll(() => page.locator('[data-proof="theme"]').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
  const hashes: string[] = [];
  for (const [index, canvas] of (await page.locator('[data-theme-base-scale]').all()).entries()) {
    // The desktop preview rail is sticky. Restore the same natural viewport
    // before each native element capture; keep the product CSS and pixels raw.
    await page.evaluate(() => { scrollTo(0, 0); return new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    const facts = await canvas.evaluate(element => { const r = element.getBoundingClientRect(); return { html: element.outerHTML, rectangle: { x: r.x, y: r.y, width: r.width, height: r.height }, scroll: { x: scrollX, y: scrollY }, dpr: devicePixelRatio }; });
    const png = await canvas.screenshot();
    await attach(info, `canvas-${stage}-${index}`, png, "image/png");
    await attach(info, `canvas-${stage}-${index}-facts`, Buffer.from(JSON.stringify(facts, null, 2)), "application/json");
    hashes.push(createHash("sha256").update(png).digest("hex"));
  }
  return hashes;
}

for (const width of [390, 1440]) {
  test(`retained audit and theme controls use Source chrome without recoloring content at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    await page.route(`${origin}/assets/*`, route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
    });
    const css = rootStyles.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
    await page.route(`${origin}/__retained?*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Behouden Control-bediening</title><style>${css}\n${audit.css}\n${editor.css}</style></head><body>${themeBootstrap}<div id="root"></div><script>globalThis.auditMarkup=${JSON.stringify(audit.html).replace(/<\/script/gi, "<\\/script")};${editor.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.setItem("veyocast-control-theme", new URL(location.href).searchParams.get("theme") === "dark" ? "dark" : "light"));
    await page.goto(`${origin}/__retained?sync=1&theme=light`);
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
    const scope = page.locator(".sites-control.sync-control.app-shell");
    await expect(scope.getByRole("heading", { name: "Activiteit", exact: true })).toBeVisible();
    await expect(scope.getByRole("button", { name: "Blauw", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.fonts.ready);
    const roles = await scope.locator('[data-proof="source-roles"]').evaluate(element => { const s = getComputedStyle(element); return { accent: s.color, accentSoft: s.backgroundColor, line: s.borderColor }; });
    const summary = scope.locator(".audit-details > summary"), presets = scope.locator('[class*="editorialPalettePresets"] > div > button'), modes = scope.locator('button[class*="editorialModeTab"]');
    const controls = summary.or(presets).or(modes);
    const initialNeutral = await neutralFacts(page);
    const initial = await computed(controls), payloadBefore = await themePayload(page), canvasBefore = await canvasFacts(page), editingBefore = await canvasEditingFacts(page), rasterBefore = await canvasHashes(page, info, "initial");
    const criticalBefore = await scope.locator('[data-proof="critical"]').evaluate(element => { const s = getComputedStyle(element); return { background: s.backgroundColor, color: s.color, border: s.borderColor }; });
    await attach(info, `current-controls-${width}`, Buffer.from(JSON.stringify({ roles, controls: initial, payload: payloadBefore, canvases: canvasBefore, canvasHashes: rasterBefore, critical: criticalBefore }, null, 2)), "application/json");
    await summary.scrollIntoViewIfNeeded(); await attach(info, `actual-audit-${width}`, await page.screenshot(), "image/png");
    expect.soft(initial.find(row => row.label === "Commandodetails")!.color).toBe(roles.accent);
    for (const row of initial) { expect.soft(row.fontSize, row.label).toBeGreaterThanOrEqual(14); expect.soft(row.height, row.label).toBeGreaterThanOrEqual(44); expect.soft(row.width, row.label).toBeGreaterThanOrEqual(44); }
    const selected = initial.filter(row => row.selected === "true");
    expect(selected.map(row => row.label)).toEqual(["Blauw", "Alles licht", "Licht"]);
    for (const row of selected) {
      expect.soft(row.border, row.label).toBe(roles.accent);
      if (row.label !== "Blauw") { expect.soft(row.color, row.label).toBe(roles.accent); expect.soft(row.background, row.label).toBe(roles.accentSoft); }
      else expect.soft(row.shadow).toContain(roles.accent);
    }
    expect(initial.find(row => row.label === "Oranje")!.swatch).toBe("rgb(224, 106, 20)");
    await summary.focus(); await page.keyboard.press("Enter"); await expect(summary.locator("..")).toHaveAttribute("open", "");
    await expect(summary.locator("..").getByText("publish", { exact: true })).toBeVisible();
    await page.keyboard.press("Space"); await expect(summary.locator("..")).not.toHaveAttribute("open", ""); await expect(summary).toBeFocused();
    const editorScope = scope.locator('[data-proof="theme"]');
    const metadata = editorScope.locator('[class*="editorialSectionEyebrow"],[class*="editorialTokenDisclosureIndicator"]');
    const metadataBefore = await computed(metadata), previewTextBefore = await page.locator('[data-theme-base-scale]').allTextContents();
    await attach(info, `editor-metadata-${width}`, Buffer.from(JSON.stringify(metadataBefore, null, 2)), "application/json");
    for (const row of metadataBefore) expect.soft(row.color, row.label).toBe(roles.accent);
    for (const row of await computed(editorScope.locator('[class*="editorialSectionEyebrow"]'))) expect(row.fontSize).toBe(11);
    for (const row of await computed(editorScope.locator('[class*="editorialTokenDisclosureIndicator"]'))) expect(row.fontSize).toBe(20);
    const tokenGroup = editorScope.locator('details[class*="editorialTokenGroup"]').first();
    const disclosure = tokenGroup.locator(":scope > summary"), indicator = tokenGroup.locator('[class*="editorialTokenDisclosureIndicator"]');
    const swatchColors = () => tokenGroup.locator('[class*="editorialTokenSwatches"] i').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    const swatchesBefore = await swatchColors();
    await disclosure.click(); await expect(tokenGroup).toHaveAttribute("open", "");
    expect.soft(await indicator.evaluate(node => getComputedStyle(node).color)).toBe(roles.accent); await expect(indicator).toHaveCSS("transform", "matrix(0, 1, -1, 0, 0, 0)");
    expect(await swatchColors()).toEqual(swatchesBefore); expect(await themePayload(page)).toEqual(payloadBefore);
    await disclosure.click(); await expect(tokenGroup).not.toHaveAttribute("open", "");
    const tokenInput = editorScope.locator('input[name="light-text"]');
    const tokenField = tokenInput.locator('xpath=ancestor::div[contains(@class,"editorialTokenField")][1]');
    const originalTextToken = await tokenInput.inputValue();
    await tokenField.hover(); await expect(tokenField).toHaveAttribute("data-active", "true");
    expect.soft((await settledFieldChrome(tokenField)).border).toBe(roles.accent);
    expect.soft((await settledFieldChrome(tokenField)).shadow).toContain(roles.accentSoft);
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await page.locator('[data-theme-base-scale]').allTextContents()).toEqual(previewTextBefore);
    await tokenInput.focus(); await expect(tokenInput).toBeFocused();
    expect.soft((await settledFieldChrome(tokenField)).border).toBe(roles.accent);
    const statusRoles = await scope.locator('[data-proof="semantic-status-roles"]').evaluate(node => { const style = getComputedStyle(node); return { success: style.color, critical: style.borderColor }; });
    const contrastSummary = editorScope.locator('[class*="editorialContrastSummary"]');
    await expect(contrastSummary).toHaveAttribute("data-valid", "true"); await expect(contrastSummary).toHaveCSS("color", statusRoles.success);
    const validSummary = await computed(contrastSummary);
    await tokenInput.fill("");
    expect(await tokenInput.evaluate(node => (node as HTMLInputElement).validity.valid)).toBe(false);
    await expect(editorScope.locator('input[name="themeSaveReadiness"]')).toHaveValue("blocked");
    await expect(contrastSummary).toHaveAttribute("data-valid", "false"); await expect(contrastSummary).toHaveCSS("color", statusRoles.critical);
    expect(await tokenField.evaluate(node => getComputedStyle(node).borderColor)).not.toBe(roles.accent);
    expect(await tokenField.evaluate(node => getComputedStyle(node).boxShadow)).not.toContain(roles.accentSoft);
    const invalidSyntax = await computed(tokenField), invalidSummary = await computed(contrastSummary);
    await tokenInput.fill("#FFFFFF");
    expect(await tokenInput.evaluate(node => (node as HTMLInputElement).validity.valid)).toBe(true);
    await expect(editorScope.locator('input[name="themeSaveReadiness"]')).toHaveValue("blocked");
    await expect(contrastSummary).toHaveAttribute("data-valid", "false"); await expect(contrastSummary).toHaveCSS("color", statusRoles.critical);
    expect.soft((await settledFieldChrome(tokenField)).border).toBe(roles.accent);
    await tokenInput.fill(originalTextToken);
    await expect(editorScope.locator('input[name="themeSaveReadiness"]')).toHaveValue("ready");
    await expect(contrastSummary).toHaveAttribute("data-valid", "true"); await expect(contrastSummary).toHaveCSS("color", statusRoles.success);
    await editorScope.getByRole("button", { name: "Blauw", exact: true }).click(); await page.mouse.move(0, 0);
    await expect(tokenField).not.toHaveAttribute("data-active", "true");
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await canvasEditingFacts(page)).toEqual(editingBefore);
    expect(await computed(metadata)).toEqual(metadataBefore); expect(await computed(contrastSummary)).toEqual(validSummary);
    await attach(info, `editor-focus-recovery-${width}`, Buffer.from(JSON.stringify({ originalTextToken, invalidSyntax, validSummary, invalidSummary, restoredSummary: await computed(contrastSummary), recoveredEditingFacts: await canvasEditingFacts(page), rawRecoveredCanvas: await canvasFacts(page) }, null, 2)), "application/json");
    // Re-enter the identical initial state through a real reload before the
    // existing exact full-HTML comparisons; no product DOM/style is rewritten.
    await page.reload(); await expect(scope.getByRole("button", { name: "Blauw", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.fonts.ready); expect(await canvasFacts(page)).toEqual(canvasBefore);
    await editorScope.getByRole("tab", { name: "Donker", exact: true }).click();
    await expect(editorScope.getByRole("tabpanel", { name: "Donker kleurenpalet" })).toBeVisible();
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await canvasFacts(page)).toEqual(canvasBefore);
    const editingDarkRasters = await canvasHashes(page, info, "editing-dark");
    await attach(info, `different-editing-state-${width}`, Buffer.from(JSON.stringify({ initial: rasterBefore, editingDark: editingDarkRasters, exactPixelComparisonClaimed: false }, null, 2)), "application/json");
    await editorScope.getByRole("tab", { name: "Licht", exact: true }).click();
    const returnedLightRasters = await canvasHashes(page, info, "returned-light");
    await attach(info, `returned-state-pixels-${width}`, Buffer.from(JSON.stringify({ initial: rasterBefore, returnedLight: returnedLightRasters, exactPixels: JSON.stringify(rasterBefore) === JSON.stringify(returnedLightRasters), pixelPassClaimed: false }, null, 2)), "application/json");
    await editorScope.getByRole("button", { name: "Alles donker", exact: true }).click();
    const darkPayload = await themePayload(page), expected = await page.evaluate(() => (globalThis as unknown as { expectedRetainedThemes: { blueLight: unknown; blueDark: unknown; orangeLight: unknown } }).expectedRetainedThemes);
    expect(JSON.parse(String(darkPayload.themeColorOverridesJson))).toEqual({ fieldflow: expected.blueDark });
    expect(darkPayload.themeFixedMode).toBe("dark");
    await editorScope.getByRole("button", { name: "Alles licht", exact: true }).click();
    await editorScope.getByRole("button", { name: "Oranje", exact: true }).click();
    await expect(editorScope.locator('input[name="themeAccent"]')).toHaveValue("#E06A14");
    expect(JSON.parse(String((await themePayload(page)).themeColorOverridesJson))).toEqual({ fieldflow: expected.orangeLight });
    expect((await canvasFacts(page)).every(canvas => canvas.accent === "rgb(224, 106, 20)")).toBe(true);
    const orange = editorScope.getByRole("button", { name: "Oranje", exact: true });
    await expect.soft(orange).toHaveCSS("border-color", roles.accent); await expect(orange.locator("i")).toHaveCSS("background-color", "rgb(224, 106, 20)");
    await attach(info, `actual-orange-content-${width}`, await editorScope.locator('[class*="editorialPaletteCard"]').first().screenshot(), "image/png");
    await editorScope.getByRole("button", { name: "Blauw", exact: true }).click();
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await canvasFacts(page)).toEqual(canvasBefore); const restoredRasters = await canvasHashes(page, info, "restored-light");
    await attach(info, `restored-state-pixels-${width}`, Buffer.from(JSON.stringify({ initial: rasterBefore, restored: restoredRasters, exactPixels: JSON.stringify(rasterBefore) === JSON.stringify(restoredRasters), pixelPassClaimed: false }, null, 2)), "application/json");
    const axe = await new AxeBuilder({ page }).include(".sync-control .audit-details > summary").include('.sync-control button[class*="editorialModeTab"]').include('.sync-control [class*="editorialPalettePresets"] > div > button').include('.sync-control [class*="editorialSectionEyebrow"]').include('.sync-control [class*="editorialTokenDisclosureIndicator"]').withRules(["color-contrast", "target-size"]).analyze();
    await attach(info, `targeted-axe-${width}`, Buffer.from(JSON.stringify({ violations: axe.violations, incomplete: axe.incomplete }, null, 2)), "application/json"); expect.soft(axe.violations).toEqual([]); expect(axe.incomplete, "Target controls must be evaluated rather than silently incomplete").toEqual([]);
    expect(await scope.locator('[data-proof="critical"]').evaluate(element => { const s = getComputedStyle(element); return { background: s.backgroundColor, color: s.color, border: s.borderColor }; })).toEqual(criticalBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`${origin}/__retained?sync=1&theme=dark`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "dark");
    expect(await page.evaluate(() => localStorage.getItem("veyocast-control-theme"))).toBe("dark");
    await expect(scope.getByRole("button", { name: "Blauw", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.fonts.ready);
    const darkControls = await computed(controls); for (const row of darkControls.filter(row => row.selected === "true" || row.label === "Commandodetails")) { expect.soft(row.border, row.label).toBe(roles.accent); if (row.label !== "Blauw") expect.soft(row.color, row.label).toBe(roles.accent); }
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await canvasFacts(page)).toEqual(canvasBefore);
    const darkNeutral = await neutralFacts(page), structural = (value: typeof darkNeutral[number]) => ({ ...value, color: undefined, contrast: undefined, dot: value.dot ? { ...value.dot, color: undefined } : null });
    await attach(info, `neutral-light-dark-${width}`, Buffer.from(JSON.stringify({ light: initialNeutral, dark: darkNeutral }, null, 2)), "application/json");
    expect(darkNeutral.map(structural)).toEqual(initialNeutral.map(structural));
    expect(darkNeutral.map(row => row.label)).toEqual(["Eigenaar", "Eigenaar"]);
    for (const row of darkNeutral) { expect(row.background).toBe("rgb(240, 243, 241)"); expect.soft(row.contrast, "Actual neutral account status under stored Donker").toBeGreaterThanOrEqual(4.5); if (row.dot) { expect(row.dot.hidden).toBe("true"); expect(row.dot.color).toBe(row.color); } }
    const neutralAxe = await new AxeBuilder({ page }).include('.sync-control [data-proof="neutral"]').withRules(["color-contrast"]).analyze();
    await attach(info, `neutral-dark-axe-${width}`, Buffer.from(JSON.stringify({ violations: neutralAxe.violations, incomplete: neutralAxe.incomplete }, null, 2)), "application/json");
    expect.soft(neutralAxe.violations).toEqual([]); expect(neutralAxe.incomplete).toEqual([]);
    await attach(info, `dark-controls-${width}`, Buffer.from(JSON.stringify(darkControls, null, 2)), "application/json");
    await page.goto(`${origin}/__retained?sync=0&theme=dark`); await expect(page.getByRole("button", { name: "Blauw", exact: true })).toHaveAttribute("aria-pressed", "true");
    const outside = page.locator(".sites-control.app-shell:not(.sync-control)");
    await expect(outside.locator(".audit-details > summary")).toHaveCSS("color", "rgb(255, 92, 32)");
    await expect(outside.getByRole("button", { name: "Blauw", exact: true })).toHaveCSS("border-color", "rgb(255, 92, 32)");
    await expect(outside.getByRole("button", { name: "Alles licht", exact: true })).toHaveCSS("color", "rgb(255, 92, 32)");
    expect(await themePayload(page)).toEqual(payloadBefore); expect(await canvasFacts(page)).toEqual(canvasBefore);
    for (const row of await computed(outside.locator('[class*="editorialSectionEyebrow"],[class*="editorialTokenDisclosureIndicator"]'))) expect(row.color).toBe("rgb(255, 92, 32)");
    const outsideTokenInput = outside.locator('input[name="light-text"]'), outsideTokenField = outsideTokenInput.locator('xpath=ancestor::div[contains(@class,"editorialTokenField")][1]');
    await outsideTokenInput.focus();
    expect(await outsideTokenField.evaluate(node => getComputedStyle(node).borderColor)).not.toBe(roles.accent);
    expect(await outsideTokenField.evaluate(node => getComputedStyle(node).boxShadow)).not.toContain(roles.accentSoft);
    const outsideInk = await outside.locator('[data-proof="outside-ink"]').evaluate(element => getComputedStyle(element).color);
    for (const row of await neutralFacts(page)) { expect(row.color).toBe(outsideInk); expect(row.background).toBe("rgb(240, 243, 241)"); if (row.dot) expect(row.dot.color).toBe(row.color); }
    await attach(info, `outside-sync-${width}`, Buffer.from(JSON.stringify(await computed(outside.locator('.audit-details > summary,button[class*="editorialModeTab"],[class*="editorialPalettePresets"] > div > button')), null, 2)), "application/json");
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}


for (const width of [390, 1440]) {
  test(`retained theme eyebrow and native motion label stay readable without payload drift at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    await page.route(`${origin}/assets/*`, route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
    });
    const css = rootStyles.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
    await page.route(`${origin}/__retained?*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Behouden Control-bediening</title><style>${css}\n${audit.css}\n${editor.css}</style></head><body>${themeBootstrap}<div id="root"></div><script>globalThis.auditMarkup=${JSON.stringify(audit.html).replace(/<\/script/gi, "<\\/script")};${editor.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.setItem("veyocast-control-theme", "light"));
    await page.goto(`${origin}/__retained?sync=1&theme=light`);
    const scope = page.locator('.sync-control [data-proof="theme"]');
    await expect(scope.getByRole("button", { name: "Blauw", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => document.fonts.ready);
    const roles = await page.locator('[data-proof="source-roles"]').evaluate(element => { const s = getComputedStyle(element); return { accent: s.color, accentSoft: s.backgroundColor, line: s.borderColor }; });
    const accent = roles.accent;
    const scopeBadge = scope.locator('[class*="editorialThemeScope"]');
    await expect(scopeBadge).toHaveText("Tenantbreed");
    await expect(scopeBadge).toHaveCSS("color", roles.accent);
    await expect(scopeBadge).toHaveCSS("background-color", roles.accentSoft);
    await expect(scopeBadge).toHaveCSS("border-color", roles.line);
    const eyebrow = scope.locator('[class*="editorialThemeEyebrow"]');
    await expect(eyebrow).toHaveCSS("color", accent);
    const label = scope.locator("label.settings-check-card"), checkbox = label.getByRole("checkbox"), title = label.locator("strong"), help = label.locator("small");
    await expect(title).toHaveText("Rustige bewegingen");
    await label.scrollIntoViewIfNeeded();
    await expect(title).toHaveCSS("font-size", "14px"); await expect(help).toHaveCSS("font-size", "13px");
    const geometry = await label.evaluate(node => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { label: rect(node), title: rect(node.querySelector("strong")!), help: rect(node.querySelector("small")!), clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
    });
    expect(geometry.label.width).toBeGreaterThanOrEqual(44); expect(geometry.label.height).toBeGreaterThanOrEqual(44);
    expect(geometry.title.bottom).toBeLessThanOrEqual(geometry.help.top); expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    const formPayload = () => scope.locator("form").evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)));
    const before = await formPayload(), appearanceBefore = JSON.parse(String(before.themeAppearanceJson)), canvasBefore = await canvasFacts(page);
    const assertMotionOnly = async (enabled: boolean) => {
      const after = await formPayload();
      expect({ ...after, themeAppearanceJson: before.themeAppearanceJson }).toEqual(before);
      expect(JSON.parse(String(after.themeAppearanceJson))).toEqual({ ...appearanceBefore, motionEnabled: enabled });
      await expect(checkbox).toBeChecked({ checked: enabled });
    };
    await checkbox.focus(); await expect(checkbox).toBeFocused(); await page.keyboard.press("Space"); await assertMotionOnly(!appearanceBefore.motionEnabled);
    await expect(checkbox).toHaveCSS("outline-style", "solid");
    await title.click(); await assertMotionOnly(appearanceBefore.motionEnabled);
    await help.click(); await assertMotionOnly(!appearanceBefore.motionEnabled);
    await checkbox.focus(); await page.keyboard.press("Space"); await assertMotionOnly(appearanceBefore.motionEnabled);
    expect(await formPayload()).toEqual(before); expect(await canvasFacts(page)).toEqual(canvasBefore);
    const axe = await new AxeBuilder({ page }).include("label.settings-check-card").withRules(["color-contrast", "target-size"]).analyze();
    expect(axe.violations).toEqual([]); expect(axe.incomplete).toEqual([]);
    await attach(info, `native-motion-label-${width}`, await label.screenshot(), "image/png");
    await attach(info, `motion-label-geometry-${width}`, Buffer.from(JSON.stringify({ geometry, appearance: appearanceBefore, axe })), "application/json");
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}
