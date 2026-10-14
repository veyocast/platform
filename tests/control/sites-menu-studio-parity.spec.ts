import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(join(process.cwd(), "package.json"));
const sharp = require(require.resolve("sharp", {paths: [join(process.cwd(),"apps/media-worker")]}));
const esbuild = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const evidence = process.env.S216_VISUAL_EVIDENCE_DIRECTORY ?? "/tmp/veyocast-s216-visual";
let js = "";
const entry = `
import React from 'react';import{createRoot}from'react-dom/client';
import{studioSitesSystemTemplates}from'./packages/studio/src/sites';
import{SitesPresentationView}from'./packages/content-templates/src/sites-presentation';
import{sitesDynamicConfigurationSchema}from'./packages/contracts/src/sites-presentation';
const params=new URLSearchParams(location.search),orientation=params.get('orientation'),widgets=params.get('widgets')==='1';
const template=studioSitesSystemTemplates.find(t=>t.document.sitesPresentation?.slide.unifiedKind==='kantine'&&t.document.sitesPresentation?.slide.themeId==='onzetrots-tv'&&t.document.sitesPresentation?.slide.orientation===orientation);
if(!template)throw Error('Missing original Studio kantine template');
const original=template.document.sitesPresentation;
const categories=[...new Set(original.slide.tv.rows.map(row=>row.tag||'Assortiment'))];
const presentation=widgets?{kind:'dynamic',configuration:sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:'sites-v17',sourceRevision:original.sourceRevision,provider:'menu',unifiedKind:'kantine',themeId:'onzetrots-tv',orientation,title:original.slide.title,subtitle:original.slide.tv.subtitle,accent:'#03438a',safeArea:6,overlay:0,menuWidgets:true}),content:{...original.slide.tv,menuPages:[{id:'menu',columns:orientation==='portrait'?1:2,widgets:categories.map((title,index)=>({id:title,type:'category',column:'full',columns:2,title,rows:original.slide.tv.rows.filter(row=>(row.tag||'Assortiment')===title).map((row,n)=>({...row,column:n%2+1}))}))}]}}:original;
createRoot(document.getElementById('root')).render(<SitesPresentationView presentation={presentation} fitViewport={true}/>);
`;
test.beforeAll(() => {
  const script = `const {build}=require(${JSON.stringify(esbuild)});const r=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"'}});process.stdout.write(JSON.stringify(r.outputFiles[0].text));`;
  js = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1;})`], { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 }));
  mkdirSync(evidence, { recursive: true });
});
async function mount(page: Page, orientation: string, widgets: boolean, width: number, height: number) {
  const errors: string[] = []; page.on("pageerror",error=>errors.push(error.message));
  await page.setViewportSize({ width, height });
  await page.route("**/__menu-parity*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><head><style>@font-face{font-family:'Manrope Variable';src:url('/fonts/manrope.woff2') format('woff2');font-weight:200 800;font-display:swap}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/giu,"<\\/script")}</script></body></html>` }));
  await page.route(/\/(?:onzetrots|onzetrots-tv|fonts|fieldflow)\//u, route => {const path=new URL(route.request().url()).pathname;return route.fulfill({contentType:path.endsWith(".svg")?"image/svg+xml":path.endsWith(".ttf")?"font/ttf":path.endsWith(".woff2")?"font/woff2":path.endsWith(".png")?"image/png":"image/webp",body:readFileSync(join(process.cwd(),"apps/control/public",path))});});
  await page.goto(`http://127.0.0.1:3343/__menu-parity?orientation=${orientation}&widgets=${widgets?1:0}`);
  await expect.poll(async()=>({count:await page.locator(".uc-slide-title").count(),errors}),{timeout:5000}).toEqual({count:1,errors:[]});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
  await page.waitForTimeout(150);
}
for (const orientation of ["portrait", "landscape"] as const) {
  test(`S216 original Studio shell pixel parity ${orientation}`, async ({ page }) => {
    const width=orientation==="portrait"?1080:1920, height=orientation==="portrait"?1920:1080;
    await mount(page,orientation,false,width,height);
    const header=await page.locator(".uc-header").screenshot();
    const footer=await page.locator(".uc-footer").screenshot();
    const bars=orientation === "portrait" ? await Promise.all([0,1,2].map(index=>page.locator(".ucc-menu-category>header").nth(index).screenshot())) : [];
    const scenery=await page.screenshot({mask:[page.locator(".uc-header"),page.locator(".uc-body"),page.locator(".uc-footer")]});
    await page.screenshot({path:join(evidence,`${orientation}-studio.png`)});
    await mount(page,orientation,true,width,height);
    await page.screenshot({path:join(evidence,`${orientation}-widgets.png`)});
    expect(await pixelHash(await page.locator(".uc-header").screenshot())).toBe(await pixelHash(header));
    expect(await pixelHash(await page.locator(".uc-footer").screenshot())).toBe(await pixelHash(footer));
    expect(await pixelHash(await page.screenshot({mask:[page.locator(".uc-header"),page.locator(".uc-body"),page.locator(".uc-footer")]}))).toBe(await pixelHash(scenery));
    for(const [index,bar] of bars.entries())expect(await pixelHash(await page.locator(".vm-widget>header").nth(index).screenshot())).toBe(await pixelHash(bar));
    await expect(page.locator(".vm-widget")).toHaveCount(3);
    expect(await page.locator(".vm-widget>header>span").allTextContents()).toEqual(["01","02","03"]);
    await expect(page.locator(".vm-product")).toHaveCount(6);
    const metrics=await page.locator(".uc-slide").evaluate(canvas=>({font:getComputedStyle(canvas.querySelector('h1')!).fontFamily,fit:getComputedStyle(canvas.querySelector('.vm-content')!).getPropertyValue('--led-auto-fit'),title:canvas.querySelector('h1')!.textContent}));
    expect(metrics.font).toContain("UC Display");if(orientation === "portrait")expect(Number(metrics.fit)).toBe(1);else expect(Number(metrics.fit)).toBeGreaterThan(.5);
    writeFileSync(join(evidence,`${orientation}-readback.json`),JSON.stringify({orientation,header:"pixel-identical",footer:"pixel-identical",scenery:"pixel-identical",metrics},null,2));
  });
  for(const [width,height] of [[390,844],[768,900],[1440,900],[3840,2160]])test(`S216 ${orientation} content stays inside viewport ${width}x${height}`,async({page})=>{
    await mount(page,orientation,true,width!,height!);
    const bounds=await page.locator(".uc-slide").evaluateAll(canvases=>canvases.flatMap(canvas=>[canvas,...canvas.querySelectorAll('.uc-header,.uc-body,.uc-footer,.vm-product,.vm-widget header')].map(element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};})));
    for(const b of bounds){expect(b.x).toBeGreaterThanOrEqual(-.1);expect(b.y).toBeGreaterThanOrEqual(-.1);expect(b.right).toBeLessThanOrEqual(width!+.1);expect(b.bottom).toBeLessThanOrEqual(height!+.1);}
  });
}

async function pixelHash(bytes: Buffer) {return createHash("sha256").update(await sharp(bytes).ensureAlpha().raw().toBuffer()).digest("hex");}
