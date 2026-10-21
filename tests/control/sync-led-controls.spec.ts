import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Real retained LED editor, state, preview and preset renderer. Only framework
// navigation/image and server-action transport are controlled; no server runs.
const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const origin = "http://127.0.0.1:3466";
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import{LedScoresAlertEditor}from'./apps/control/app/(shell)/dashboard/studio/led-scores/alert-editor';
import{LiveMatchSlideEditor}from'./apps/control/app/(shell)/dashboard/studio/led-scores/live-match-slide-editor';
const id=n=>'24600000-0000-4000-8000-'+String(n).padStart(12,'0');
const design=(headline)=>({headline,palette:'electric-orange',animation:'none',showScorer:false});
const initial={id:null,revision:0,name:'Eigen LED-previewproef',connectionId:id(1),durationMs:8000,priority:100,underlayPolicy:'continue',groupIds:[id(2)],config:{ownDesign:design('Eigen goal'),opponentDesign:design('Tegengoal'),unknownDesign:design('Onbekende goal')}};
createRoot(document.getElementById('root')).render(<div className={'sites-control vx-shell app-shell design-sync'+(new URLSearchParams(location.search).get('sync')==='1'?' sync-control':'')} data-fieldflow="v3" data-shell-mode="standard" style={{display:'block'}}><div className="vx-main"><div className="vx-content main-content"><LiveMatchSlideEditor connections={[{id:id(1),name:'Eigen gecontroleerde bron'}]} idempotencyKey={id(4)} slides={[]}/><LedScoresAlertEditor initial={initial} alerts={[]} assets={[]} connections={[{id:id(1),name:'Eigen gecontroleerde bron',mappings:[{side:'own',teamKey:'1',teamName:'Eigen testteam'}],liveState:{home:{name:'Eigen thuisteam',score:1},away:{name:'Eigen uitteam',score:0},sourceUpdatedAt:'2026-10-19T10:00:00Z',clockSeconds:144}}]} groups={[{id:id(2),name:'Eigen groep',screenIds:[id(3)]}]} screens={[{id:id(3),name:'Eigen scherm',status:'online'}]} sponsors={[]} uploadConfig={null}/></div></div></div>);`;
  const script = `const fs=require('node:fs'),path=require('node:path');const r=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'controlled-framework-action-transport',setup(b){
b.onResolve({filter:/actions$/},a=>{const file=path.resolve(a.resolveDir,a.path)+'.ts';return fs.existsSync(file)?{path:file,namespace:'actions'}:undefined});
b.onLoad({filter:/.*/,namespace:'actions'},a=>({contents:[...fs.readFileSync(a.path,'utf8').matchAll(/export (?:async )?function (\\w+)/g)].map(m=>'export async function '+m[1]+'(...args){await fetch("/__led-controls/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:'+JSON.stringify(m[1])+',args})});throw Error("Preview controls must never submit a command")}').join(';'),loader:'js'}));
b.onResolve({filter:/^next\\/navigation$/},()=>({path:'navigation',namespace:'framework'}));
b.onResolve({filter:/^next\\/image$/},()=>({path:'image',namespace:'framework'}));
b.onResolve({filter:/^next\\/link$/},()=>({path:'link',namespace:'framework'}));
b.onLoad({filter:/.*/,namespace:'framework'},a=>({contents:a.path==='navigation'?'export function useRouter(){return{refresh(){throw Error("Unexpected navigation")}}}':a.path==='link'?'import React from"react";export default function Link({children,...props}){return React.createElement("a",props,children)}':'import React from"react";export default function Image({fill,unoptimized,priority,...props}){return React.createElement("img",props)}',loader:'js',resolveDir:process.cwd()}));
b.onResolve({filter:/^\\//},()=>({external:true}));
}}]});process.stdout.write(JSON.stringify({js:r.outputFiles.find(f=>f.path.endsWith('.js')).text,css:r.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024
  })) as typeof bundle;
});

async function mount(page: Page) {
  const commands: unknown[] = [], errors: string[] = [], unexpected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"]
    .map(file => readFileSync(join(root, file), "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && url.pathname === "/__led-controls/command") {
      commands.push(request.postDataJSON());
      return route.fulfill({ json: { error: "This preview fixture never writes." } });
    }
    if (url.origin === origin && url.pathname === "/__led-controls") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LED-previewbediening · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
    const publicRoot = join(root, "apps/control/public"), asset = resolve(publicRoot, `.${url.pathname}`);
    if (url.origin === origin && asset.startsWith(`${publicRoot}/`) && existsSync(asset) && request.method() === "GET") {
      const mime: Record<string, string> = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg" };
      return route.fulfill({ body: readFileSync(asset), contentType: mime[extname(asset)] ?? "application/octet-stream" });
    }
    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  return { commands, errors, unexpected };
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  });
}

async function preset(page: Page, path: string) {
  await page.locator("form > main > div").getByRole("button", { name: "Volgende", exact: true }).click();
  const slide = page.locator('section[aria-labelledby="experience-design"] .uc-slide');
  await expect(slide).toBeVisible();
  await slide.scrollIntoViewIfNeeded();
  await settle(page);
  expect(await slide.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const png = await slide.screenshot({ path, animations: "disabled" });
  await page.locator("form > main > div").getByRole("button", { name: "Vorige", exact: true }).click();
  return createHash("sha256").update(png).digest("hex");
}

async function palette(control: Locator) {
  return control.evaluate(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { background: style.backgroundColor, border: style.borderTopColor, color: style.color, font: style.fontSize, height: rect.height, width: rect.width };
  });
}

async function sourceChoice(control: Locator) {
  await control.evaluate(async element => { void getComputedStyle(element).backgroundColor; await Promise.all(element.getAnimations().map(animation => animation.finished)); });
  const colors = await palette(control);
  expect.soft(colors.background).toBe("rgb(221, 247, 233)");
  expect.soft(colors.border).toBe("rgb(0, 109, 115)");
}

async function outsideChoices(page: Page) {
  const targets = [page.locator('[class*="moduleIcon"]').first(), page.locator('[class*="momentIcon"]').first(), page.locator('button[aria-current="step"]'), page.locator('button[aria-current="step"] > span').first(), page.locator('article[class*="momentCard"][data-selected="true"]'), page.locator('input[name="orientation"]:checked').locator(".."), page.locator('input[name="template"]:checked').locator("..")];
  targets.push(...await page.locator('section[aria-labelledby^="experience-"] > div[class*="sectionHeading"] > div > span, [class*="publishExplanation"] > div > span').all());
  return {
    palettes: await Promise.all(targets.map(palette)),
    counters: await page.locator('[aria-label="Volgorde voor spelermedia"] li').evaluateAll(items => items.map(item => { const style = getComputedStyle(item, "::before"); return { background: style.backgroundColor, color: style.color, font: style.fontSize, content: style.content }; })),
    intro: await page.locator('[class*="liveSlideIntro"]').evaluate(element => { const style = getComputedStyle(element), box = element.getBoundingClientRect(); return { image: style.backgroundImage, color: style.color, padding: style.padding, width: box.width, height: box.height }; })
  };
}

async function numberedStates(page: Page, output: (name: string) => string) {
  const intro = page.locator('[class*="liveSlideIntro"]');
  expect.soft(await intro.evaluate(element => getComputedStyle(element).backgroundImage)).toBe("linear-gradient(135deg, rgb(10, 10, 10), color(srgb 0.0321569 0.109098 0.113333))");
  await intro.screenshot({ path: output("actual-source-intro.png") });
  const stages = ["moments", "design", "media", "targets", "review"];
  for (const [index, stage] of stages.entries()) {
    if (index) await page.locator("form > main > div").getByRole("button", { name: "Volgende", exact: true }).click();
    const section = page.locator(`section[aria-labelledby="experience-${stage}"]`);
    await expect(section).toBeVisible();
    const number = section.locator(':scope > div[class*="sectionHeading"] > div > span');
    await expect(number).toHaveText(String(index + 1));
    const colors = await palette(number);
    expect.soft(colors.background).toBe("rgb(0, 109, 115)"); expect.soft(colors.color).toBe("rgb(255, 255, 255)");
    if (stage === "media") {
      const flow = section.locator('[aria-label="Volgorde voor spelermedia"]');
      await expect(flow.locator("li")).toHaveText(["Spelerfoto uit LED Scores", "Gekozen eigen-goalmedia", "Clublogo en teksttemplate"]);
      for (const counter of await flow.locator("li").evaluateAll(items => items.map(item => { const style = getComputedStyle(item, "::before"); return { background: style.backgroundColor, color: style.color, content: style.content }; }))) {
        expect(counter.content).toBe("counter(fallback)");
        expect.soft(counter.background).toBe("rgb(0, 109, 115)"); expect.soft(counter.color).toBe("rgb(255, 255, 255)");
      }
      await flow.screenshot({ path: output("actual-source-fallback.png") });
    }
    if (stage === "review") {
      const explanation = section.locator('[class*="publishExplanation"]');
      await expect(explanation.locator(":scope > div > span")).toHaveText(["1", "2", "3"]);
      await expect(explanation).toContainText("Concept opslaan"); await expect(explanation).toContainText("Immutable publiceren"); await expect(explanation).toContainText("Live testen");
      for (const number of await explanation.locator(":scope > div > span").all()) {
        const colors = await palette(number);
        expect.soft(colors.background).toBe("rgb(0, 109, 115)"); expect.soft(colors.color).toBe("rgb(255, 255, 255)");
      }
      await explanation.screenshot({ path: output("actual-source-publication-explanation.png") });
    }
  }
  for (let step = 4; step > 0; step--) await page.locator("form > main > div").getByRole("button", { name: "Vorige", exact: true }).click();
  await expect(page.locator('section[aria-labelledby="experience-moments"]')).toBeVisible();
}

async function extendedSelections(page: Page, width: number, screenshot: string) {
  const nav = page.getByRole("navigation", { name: "Stappen voor wedstrijdmomenten" });
  const current = nav.locator('button[aria-current="step"]');
  await sourceChoice(current);
  expect.soft(await current.evaluate(element => getComputedStyle(element).boxShadow)).toBe(width <= 1088 ? "rgb(0, 109, 115) 0px -3px 0px 0px inset" : "rgb(0, 109, 115) 3px 0px 0px 0px inset");
  expect.soft((await palette(current.locator(":scope > span").first())).background).toBe("rgb(0, 109, 115)");
  for (const icon of [page.locator('[class*="moduleIcon"]').first(), page.locator('[class*="momentIcon"]').first()]) {
    const colors = await palette(icon);
    expect.soft(colors.background).toBe("rgb(221, 247, 233)");
    expect.soft(colors.border).toBe("rgb(225, 234, 230)");
    expect.soft(colors.color).toBe("rgb(0, 109, 115)");
  }
  await sourceChoice(page.locator('article[class*="momentCard"][data-selected="true"]'));
  const lineup = page.locator('input[name="triggerLineup"]');
  await lineup.check(); await expect(lineup).toBeChecked();
  await sourceChoice(lineup.locator(".."));
  await lineup.uncheck(); await expect(lineup).not.toBeChecked();
  const live = page.locator('[class*="liveSlideWorkspace"]');
  const scoreboard = live.locator("[data-template][data-orientation]");
  await scoreboard.scrollIntoViewIfNeeded(); await settle(page);
  const before = await scoreboard.screenshot({ animations: "disabled" });
  const portrait = live.locator('input[name="orientation"][value="portrait"]');
  const score = live.locator('input[name="template"][value="scoreboard"]');
  await portrait.check(); await expect(portrait).toBeChecked();
  await sourceChoice(portrait.locator(".."));
  await expect(scoreboard).toHaveAttribute("data-orientation", "portrait");
  await score.check(); await expect(score).toBeChecked();
  await sourceChoice(score.locator(".."));
  await expect(scoreboard).toHaveAttribute("data-template", "scoreboard");
  await expect(scoreboard.locator("ol")).toHaveCount(0);
  await live.locator('input[name="orientation"][value="landscape"]').check();
  await live.locator('input[name="template"][value="match_center"]').check();
  await expect(scoreboard.locator("ol li")).toHaveCount(3);
  await scoreboard.scrollIntoViewIfNeeded(); await settle(page);
  expect((await scoreboard.screenshot({ path: screenshot, animations: "disabled" })).equals(before), "live slide content pixels remain exact after returning to the initial UI selections").toBe(true);
}

for (const [width, height] of [[390, 844], [1440, 1000]]) test(`actual LED preview controls use Source selection without changing content at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width: width!, height: height! });
  const state = await mount(page);
  await page.goto(`${origin}/__led-controls?sync=0`);
  const preview = page.getByRole("complementary", { name: "Live voorbeeld", exact: true });
  const orientation = preview.getByRole("group", { name: "Schermstand", exact: true });
  const moments = preview.getByRole("group", { name: "Voorbeeldmoment", exact: true });
  const landscape = orientation.getByRole("button", { name: "16:9", exact: true });
  const portrait = orientation.getByRole("button", { name: "9:16", exact: true });
  const own = moments.getByRole("button", { name: "Goal", exact: true });
  const opponent = moments.getByRole("button", { name: "Tegengoal", exact: true });
  const content = preview.locator("[data-palette]");
  await preview.scrollIntoViewIfNeeded();
  await settle(page);
  const outside = { landscape: await palette(landscape), own: await palette(own) };
  const outsideExtended = await outsideChoices(page);
  expect(outside.landscape.background).toBe("rgb(255, 92, 32)");
  expect(outside.own.background).toBe("rgb(255, 92, 32)");
  expect(outside.own.font).toBe("12px");
  await expect(content).toHaveCSS("background-color", "rgb(255, 92, 32)");

  await page.goto(`${origin}/__led-controls?sync=1`);
  const initialConfig = await page.locator('input[name="canvasExperience"]').inputValue();
  await numberedStates(page, name => info.outputPath(name));
  await extendedSelections(page, width!, info.outputPath("live-slide-content.png"));
  const beforePreset = await preset(page, info.outputPath("preset-before.png"));
  await preview.scrollIntoViewIfNeeded();
  await settle(page);
  const initialPreview = await content.screenshot({ path: info.outputPath("content-before.png"), animations: "disabled" });
  await portrait.focus();
  await page.keyboard.press("Space");
  await expect(portrait).toHaveAttribute("aria-pressed", "true");
  await expect(landscape).toHaveAttribute("aria-pressed", "false");
  await expect(content).toHaveAttribute("data-orientation", "portrait");
  await expect(preview.getByText("Staande compositie.", { exact: true })).toBeVisible();
  await expect(portrait).toHaveCSS("outline-style", "solid");
  await expect(portrait).toHaveCSS("outline-width", "3px");
  // S263 approved accent/mint focus. Read native sRGB bytes so CSS Color 4
  // serialization does not change the assertion across Chromium versions.
  const focusRgba = await portrait.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { colorSpace: "srgb" })!;
    context.fillStyle = getComputedStyle(element).outlineColor;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
  expect(focusRgba).toEqual([27, 145, 133, 255]);
  await opponent.click();
  await expect(opponent).toHaveAttribute("aria-pressed", "true");
  await expect(own).toHaveAttribute("aria-pressed", "false");
  await expect(content.getByText("Tegengoal", { exact: true })).toBeVisible();
  await expect(content).toHaveCSS("background-color", "rgb(255, 92, 32)");
  for (const control of [portrait, opponent]) {
    const active = await palette(control);
    expect.soft(active.background).toBe("rgb(221, 247, 233)");
    expect.soft(active.border).toBe("rgb(0, 109, 115)");
    expect.soft(active.color).toBe("rgb(0, 109, 115)");
  }
  for (const control of [landscape, own]) {
    const inactive = await palette(control);
    expect.soft(inactive.background).toBe("rgb(255, 255, 255)");
    expect.soft(inactive.border).toBe("rgb(225, 234, 230)");
    expect.soft(inactive.color).toBe("rgb(18, 46, 50)");
  }
  await landscape.click(); await own.click();
  await expect(landscape).toHaveAttribute("aria-pressed", "true");
  await expect(portrait).toHaveAttribute("aria-pressed", "false");
  await expect(own).toHaveAttribute("aria-pressed", "true");
  await expect(opponent).toHaveAttribute("aria-pressed", "false");
  await expect(content).toHaveAttribute("data-orientation", "landscape");
  await expect(content.getByText("Eigen goal", { exact: true })).toBeVisible();
  await expect(content).toHaveCSS("background-color", "rgb(255, 92, 32)");
  await settle(page);
  const afterPreview = await content.screenshot({ path: info.outputPath("content-after.png"), animations: "disabled" });
  expect(afterPreview.equals(initialPreview), "preview-only choices retain the exact initial content pixels").toBe(true);
  for (const control of [landscape, portrait, ...await moments.getByRole("button").all()]) {
    const metrics = await palette(control);
    expect(metrics.width).toBeGreaterThanOrEqual(44); expect(metrics.height).toBeGreaterThanOrEqual(44);
  }
  expect((await palette(landscape)).font).toBe(outside.landscape.font);
  expect((await palette(own)).font).toBe(outside.own.font);
  expect((await new AxeBuilder({ page }).include('[role="group"][aria-label="Schermstand"]').include('[role="group"][aria-label="Voorbeeldmoment"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("actual-source-controls.png") });
  const afterPreset = await preset(page, info.outputPath("preset-after.png"));
  expect(afterPreset, "preset renderer pixels remain exact through preview-only interactions").toBe(beforePreset);
  await expect(page.locator('input[name="canvasExperience"]')).toHaveValue(initialConfig);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.commands).toEqual([]); expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
  await page.goto(`${origin}/__led-controls?sync=0`); await settle(page);
  expect(await outsideChoices(page), "all extended UI families retain their exact outside-Sync palette and geometry").toEqual(outsideExtended);
  await info.attach("preview-readback.json", { body: JSON.stringify({ width, height, outside, beforePreset, afterPreset, configSha256: createHash("sha256").update(initialConfig).digest("hex"), contentSha256: createHash("sha256").update(afterPreview).digest("hex"), commands: state.commands, errors: state.errors, unexpected: state.unexpected }, null, 2), contentType: "application/json" });
});
