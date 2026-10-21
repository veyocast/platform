import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { defaultGoalOverlayConfiguration, type GoalOverlayEvent } from "../../packages/contracts/src/goal-overlay";

const origin = "http://127.0.0.1:3357";
const fixtureRequire = createRequire(join(process.cwd(), "package.json"));
const compiler = fixtureRequire.resolve("esbuild", { paths: [fixtureRequire.resolve("tsx")] });
const fontRoot = dirname(fixtureRequire.resolve("@fontsource/roboto/package.json", { paths: [join(process.cwd(), "apps/control")] }));
const configuration = defaultGoalOverlayConfiguration;
const event: GoalOverlayEvent = { eventId: "preview", homeTeam: "Duindorp SV", awayTeam: "VUC", homeScore: 2, awayScore: 1, scoreboardSide: "home", scorer: "Jack Morauw", shirtNumber: "9", minute: "67′", homeLogo: null, awayLogo: null, playerPhoto: null, competition: null, matchName: null, round: null, venue: null, test: false };
const entry = `import React,{useState}from"react";import{createRoot}from"react-dom/client";import{GoalOverlayPreview}from"./apps/control/app/(shell)/dashboard/studio/led-scores/goal-overlay/goal-overlay-preview";import{renderGoalOverlayDom,goalOverlayCss}from"./packages/content-templates/src/goal-overlay-renderer";import styles from"./apps/control/app/(shell)/dashboard/studio/led-scores/goal-overlay/goal-overlay.module.css";const configuration=${JSON.stringify(configuration)},event=${JSON.stringify(event)};function App(){const[name,setName]=useState("Mijn club");return <main className="sync-control sites-control"><label>Naam van het ontwerp<input value={name} onChange={e=>setName(e.target.value)}/></label><aside className={styles.preview} id="preview-host"><h2>Live voorbeeld</h2><div className={styles.stage}><GoalOverlayPreview configuration={configuration} event={event} orientation="landscape" appearance="light"/></div><p>Controleer je voorbeeld voordat je opslaat.</p></aside></main>}createRoot(document.getElementById("app")).render(<App/>);window.goalReference={render:renderGoalOverlayDom,css:goalOverlayCss,configuration,event};`;
const buildScript = `import {createRequire} from "node:module";const require=createRequire(import.meta.url);const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:"tsx"},nodePaths:[process.cwd()+"/apps/control/node_modules"],bundle:true,write:false,outfile:"fixture.js",platform:"browser",format:"iife",jsx:"automatic",loader:{".module.css":"local-css",".css":"css",".woff2":"file"},assetNames:"fonts/[name]-[hash]",publicPath:"/"});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith(".js")).text,css:result.outputFiles.find(f=>f.path.endsWith(".css")).text,fonts:result.outputFiles.filter(f=>f.path.endsWith(".woff2")).map(f=>({path:"/fonts/"+f.path.split("/").at(-1),bytes:Buffer.from(f.contents).toString("base64")}))}));`;
const fixture = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", buildScript], { cwd: process.cwd(), encoding: "utf8", maxBuffer: 12 * 1024 * 1024, timeout: 30_000 })) as { js: string; css: string; fonts: { path: string; bytes: string }[] };
const sharedCss = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(file => readFileSync(join(process.cwd(), file), "utf8").replace(/@import[^;]+;/g, "")).join("\n");
const fontCss = [400, 500, 700, 900].map(weight => `@font-face{font-family:Roboto;font-style:normal;font-weight:${weight};font-display:swap;src:url("${origin}/font-${weight}.woff2") format("woff2")}`).join("\n");

for (const width of [390, 1440]) {
  test(`Goal preview loads, falls back and recovers without losing input at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [], writes: string[] = [], requested: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(request.method()); });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const pending = new Set<Promise<void>>();
    await page.route(`${origin}/font-*.woff2`, route => {
      const task = (async () => {
        const weight = new URL(route.request().url()).pathname.match(/^\/font-(400|500|700|900)\.woff2$/)![1]!;
        requested.push(weight);
        const bytes = readFileSync(join(fontRoot, "files", `roboto-latin-${weight}-normal.woff2`));
        await held;
        await route.fulfill({ body: bytes, contentType: "font/woff2" });
      })();
      pending.add(task); void task.then(() => pending.delete(task), () => pending.delete(task));
      return task;
    });
    await page.route(`${origin}/fonts/*.woff2`, route => {
      const task = (async () => {
        const path = new URL(route.request().url()).pathname;
        const font = fixture.fonts.find(font => font.path === path);
        const publicFont = ["/fonts/inter.woff2", "/fonts/manrope.woff2"].includes(path)
          ? readFileSync(join(process.cwd(), "apps/control/public", path.slice(1))) : null;
        if (!font && !publicFont) throw new Error(`Unknown bundled font ${path}`);
        requested.push(path);
        await held;
        await route.fulfill({ body: publicFont ?? Buffer.from(font!.bytes, "base64"), contentType: "font/woff2" });
      })();
      pending.add(task); void task.then(() => pending.delete(task), () => pending.delete(task));
      return task;
    });
    const hostWidth = width === 390 ? 356 : 558;
    await page.route(`${origin}/fixture`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goal-voorbeeldcontrole</title><style>${sharedCss}\n${fontCss}\n${fixture.css}\nhtml,body{margin:0}#preview-host{width:${hostWidth}px;position:static}.sync-control>label{display:block;padding:8px}#reference-host{position:absolute;left:-10000px;top:0}</style></head><body><div id="app"></div><script>${fixture.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
    try {
      await page.goto(`${origin}/fixture`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("status")).toHaveText("Voorbeeld laden…");
      await expect(page.locator(".vc-goal")).toHaveCount(0);
      const name = page.getByRole("textbox", { name: "Naam van het ontwerp", exact: true });
      await name.fill("Behoud mijn clubnaam");
      await info.attach(`loading-${width}`, { body: Buffer.from(JSON.stringify({ status: await page.getByRole("status").textContent(), input: await name.inputValue() })), contentType: "application/json" });
      // A stalled font request cannot keep the operational form or preview blocked.
      await expect(page.locator(".vc-goal")).toBeVisible();
      expect(requested.length).toBeGreaterThan(0);
      await expect(name).toHaveValue("Behoud mijn clubnaam"); await expect(name).toBeFocused();
      await info.attach(`fallback-${width}`, { body: Buffer.from(JSON.stringify({ visible: await page.locator(".vc-goal").isVisible(), input: await name.inputValue(), requested })), contentType: "application/json" });
      release(); await Promise.all([...pending]);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByText("Voorbeeld laden…", { exact: true })).toHaveCount(0);
      await expect(name).toHaveValue("Behoud mijn clubnaam"); await expect(name).toBeFocused();
      const dimensions = await page.locator("#preview-host .vc-goal").evaluate(root => ({ width: root.clientWidth, height: root.clientHeight, fontSize: getComputedStyle(root).fontSize }));
      const reference = await page.evaluate(dimensions => {
        const w = window as typeof window & { goalReference: { render: (...args: unknown[]) => void; css: string; configuration: unknown; event: unknown } };
        const host = document.createElement("div"); host.id = "reference-host";
        host.style.width = `${dimensions.width}px`; host.style.height = `${dimensions.height}px`; host.style.fontSize = dimensions.fontSize; host.style.lineHeight = "1.5"; document.body.appendChild(host);
        const style = document.createElement("style"); style.textContent = w.goalReference.css; host.appendChild(style);
        const root = document.createElement("div"); root.id = "reference"; root.className = "vc-goal"; host.appendChild(root);
        w.goalReference.render(root, w.goalReference.configuration, w.goalReference.event, "landscape", "light");
        return [".vc-goal-headline", ".vc-goal-score", ".vc-goal-minute"].map(selector => ({ selector, size: getComputedStyle(root.querySelector(selector)!).fontSize, line: getComputedStyle(root.querySelector(selector)!).lineHeight }));
      }, dimensions);
      await expect.poll(() => page.locator("#preview-host .vc-goal").evaluate(root => [".vc-goal-headline", ".vc-goal-score", ".vc-goal-minute"].map(selector => ({ selector, size: getComputedStyle(root.querySelector(selector)!).fontSize, line: getComputedStyle(root.querySelector(selector)!).lineHeight })))).toEqual(reference);
      const facts = await page.locator("#preview-host .vc-goal").evaluate(root => {
        const card = root.querySelector(".vc-goal-card")!, outer = card.getBoundingClientRect();
        return { headline: parseFloat(getComputedStyle(root.querySelector(".vc-goal-headline")!).fontSize), score: parseFloat(getComputedStyle(root.querySelector(".vc-goal-score")!).fontSize), allInside: [...card.querySelectorAll("strong,p,img,.vc-goal-team-name")].every(n => { const r = n.getBoundingClientRect(); return r.left >= outer.left - 1 && r.right <= outer.right + 1 && r.top >= outer.top - 1 && r.bottom <= outer.bottom + 1; }) };
      });
      expect(facts.headline).toBeGreaterThanOrEqual(16); expect(facts.score).toBeGreaterThanOrEqual(16); expect(facts.allInside).toBe(true);
      await info.attach(`ready-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await info.attach(`renderer-parity-${width}`, { body: Buffer.from(JSON.stringify({ reference, facts, requested }, null, 2)), contentType: "application/json" });
      expect(errors).toEqual([]); expect(writes).toEqual([]);
    } finally {
      release(); await Promise.allSettled([...pending]);
    }
  });
}
