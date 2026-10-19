import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Genuine client controls/product CSS, not Next, SSR, Auth or QA-data acceptance.
const origin = "http://127.0.0.1:3349", key = "veyocast:table:s260-portal:preferences";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const styles = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"];
let js: string;
let bundleInputs: Record<string, unknown>;
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{Dialog,DialogContent,DialogDescription,DialogPortalProvider,DialogTitle,DialogTrigger}from'./packages/ui/src/components/dialog';import{Sheet,SheetContent,SheetDescription,SheetTitle,SheetTrigger}from'./packages/ui/src/components/sheet';import{TablePreferences}from'./packages/ui/src/components/table-preferences';import{Button}from'./packages/ui/src/components/button';const columns=[{id:'name',label:'Naam',required:true},{id:'status',label:'Status'}];function Sample({fallback=false}){return <Sheet><SheetTrigger asChild><Button variant="secondary">{fallback?'Buiten provider':'Onderste voorbeeld'}</Button></SheetTrigger><SheetContent side={fallback?'right':'bottom'} data-proof={fallback?'fallback':'bottom'}><SheetTitle>{fallback?'Bodyfallback':'Onderste voorbeeld'}</SheetTitle><SheetDescription>Echte Sheet met native focus en sluitbediening.</SheetDescription><Button variant="secondary">Focuspunt</Button></SheetContent></Sheet>}function App(){const[container,setContainer]=useState(null);return <><DialogPortalProvider container={container}><div ref={setContainer} className="sites-control app-shell sync-control" data-proof="scope" data-ready={Boolean(container)} style={{display:'block',padding:20,minHeight:'100dvh'}}><main><h1>Gedeelde weergavebediening</h1><span data-proof="role" style={{color:'var(--accent)'}}>Source-rol</span><TablePreferences columns={columns} tableKey="s260-portal" title="Weergave-instellingen" triggerLabel="Weergave-instellingen"/><table data-vc-table-key="s260-portal"><caption>Componentcontrole</caption><thead><tr><th data-column="name">Naam</th><th data-column="status">Status</th></tr></thead><tbody><tr><td data-column="name">Lokale controle</td><td data-column="status">Concept</td></tr></tbody></table><Sample/><Dialog><DialogTrigger asChild><Button variant="secondary">Bestaande dialoog</Button></DialogTrigger><DialogContent><DialogTitle>Bestaande dialoog</DialogTitle><DialogDescription>Dezelfde providercontainer blijft behouden.</DialogDescription></DialogContent></Dialog></main></div></DialogPortalProvider><Sample fallback/></>}createRoot(document.getElementById('root')).render(<App/>);`;
  const script = `const r=require(${JSON.stringify(compiler)}).buildSync({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules',process.cwd()+'/packages/ui/node_modules'],bundle:true,metafile:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});const hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');const inputs=Object.fromEntries(Object.entries(r.metafile.inputs).map(([path,meta])=>[path,{...meta,sha256:hash(path==='<stdin>'?${JSON.stringify(entry)}:require('node:fs').readFileSync(require('node:path').resolve(process.cwd(),path)))}]));process.stdout.write(JSON.stringify({js:r.outputFiles[0].text,inputs}));`;
  const compiled = JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30_000, maxBuffer: 12 * 1024 * 1024 }));
  js = compiled.js; bundleInputs = compiled.inputs;
});
for (const width of [390, 1440]) {
  test(`shared sheets retain Source scope, preferences and fallback at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await info.attach("actual-esbuild-inputs", { body: Buffer.from(JSON.stringify(bundleInputs, null, 2)), contentType: "application/json" });
    const errors: string[] = [], writes: string[] = [], blocked: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET") { writes.push(request.method() + " " + url.pathname); return route.abort(); }
      if (url.origin !== origin) { blocked.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname === "/fonts/inter.woff2" || url.pathname === "/fonts/manrope.woff2") {
        return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", url.pathname.slice(1))), contentType: "font/woff2" });
      }
      if (url.pathname.startsWith("/assets/")) {
        const name = url.pathname.slice(8);
        if (!/^[a-zA-Z0-9_.-]+\.(woff2|ttf|svg)$/.test(name)) { blocked.push(url.pathname); return route.abort(); }
        return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
      }
      if (url.pathname !== "/__sheet") { blocked.push(url.pathname); return route.abort(); }
      const css = styles.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sheetcomponentcontrole</title><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
    });
    await page.goto(origin + "/__sheet");
    const scope = page.locator('[data-proof="scope"]'); await expect(scope).toHaveAttribute("data-ready", "true");
    const accent = await page.locator('[data-proof="role"]').evaluate(node => getComputedStyle(node).color);
    const trigger = page.getByRole("button", { name: "Weergave-instellingen", exact: true }); await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Weergave-instellingen", exact: true }); await expect(dialog).toBeVisible();
    const checkbox = dialog.getByRole("checkbox", { name: "Status", exact: true }); await expect(checkbox).toBeChecked();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => dialog.evaluate(node => node.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
    const close = dialog.getByRole("button", { name: "Sluiten", exact: true });
    await expect(close.locator("svg")).toBeVisible();
    const closeFacts = await close.evaluate(node => { const target = node.getBoundingClientRect(), glyph = node.querySelector("svg")!.getBoundingClientRect(); return { targetWidth: target.width, targetHeight: target.height, glyphWidth: glyph.width, glyphHeight: glyph.height }; });
    await info.attach(`native-close-${width}-facts`, { body: Buffer.from(JSON.stringify(closeFacts, null, 2)), contentType: "application/json" });
    for (const size of [closeFacts.glyphWidth, closeFacts.glyphHeight]) { expect(size).toBeGreaterThanOrEqual(16); expect(size).toBeLessThanOrEqual(24); }
    for (const size of [closeFacts.targetWidth, closeFacts.targetHeight]) expect(size).toBeGreaterThanOrEqual(44);
    const facts = await dialog.evaluate(node => ({ scoped: Boolean(node.closest('[data-proof="scope"].sync-control')), accent: getComputedStyle(node.querySelector('input[type="checkbox"]')!).accentColor, width: node.getBoundingClientRect().width, viewport: innerWidth }));
    await info.attach(`sheet-${width}-facts`, { body: Buffer.from(JSON.stringify({ sourceAccent: accent, ...facts }, null, 2)), contentType: "application/json" });
    await info.attach(`native-sheet-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    expect.soft(facts.scoped).toBe(true); expect.soft(facts.accent).toBe(accent); expect(facts.width).toBeLessThanOrEqual(facts.viewport);
    await checkbox.uncheck(); await dialog.getByRole("radio", { name: "Compact", exact: true }).check();
    await expect(dialog.getByRole("radio", { name: "Compact", exact: true })).toHaveCSS("accent-color", accent);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    const table = page.locator('table[data-vc-table-key="s260-portal"]'); await expect(table).toHaveAttribute("data-vc-density", "compact");
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toMatchObject({ version: 1, density: "compact", visibleColumns: ["name"] });
    await page.reload(); await expect(scope).toHaveAttribute("data-ready", "true"); await expect(table).toHaveAttribute("data-vc-density", "compact");
    expect(await table.locator('[data-column="status"]').evaluateAll(cells => cells.every(cell => (cell as HTMLElement).hidden))).toBe(true);
    await trigger.click(); await expect(checkbox).not.toBeChecked(); await expect(dialog.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    await trigger.click(); await expect(dialog).toBeVisible(); await close.click();
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    const bottomTrigger = page.getByRole("button", { name: "Onderste voorbeeld", exact: true }); await bottomTrigger.click();
    const bottom = page.locator('[data-proof="bottom"]'); await expect(bottom).toBeVisible();
    expect(await bottom.evaluate(node => Boolean(node.closest('[data-proof="scope"]')))).toBe(true);
    await bottom.getByRole("button", { name: "Focuspunt" }).focus(); await expect(bottom.getByRole("button", { name: "Focuspunt" })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(bottom).toHaveCount(0); await expect(bottomTrigger).toBeFocused();
    const existingTrigger = page.getByRole("button", { name: "Bestaande dialoog", exact: true }); await existingTrigger.click();
    const existing = page.getByRole("dialog", { name: "Bestaande dialoog", exact: true }); await expect(existing).toBeVisible();
    expect(await existing.evaluate(node => Boolean(node.closest('[data-proof="scope"]')))).toBe(true);
    await page.keyboard.press("Escape"); await expect(existing).toHaveCount(0); await expect(existingTrigger).toBeFocused();
    const fallbackTrigger = page.getByRole("button", { name: "Buiten provider", exact: true }); await fallbackTrigger.click();
    const fallback = page.locator('[data-proof="fallback"]'); await expect(fallback).toBeVisible();
    expect(await fallback.evaluate(node => node.parentElement === document.body && !node.closest('.sync-control'))).toBe(true);
    await page.keyboard.press("Escape"); await expect(fallback).toHaveCount(0); await expect(fallbackTrigger).toBeFocused();
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(blocked).toEqual([]);
  });
}
