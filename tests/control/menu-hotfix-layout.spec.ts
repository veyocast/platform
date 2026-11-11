import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(join(process.cwd(), "package.json"));
const esbuild = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let script = "";
const entry = `
import React from 'react';import{createRoot}from'react-dom/client';
import{SitesPresentationView}from'./packages/content-templates/src/sites-presentation';
import{sitesDynamicConfigurationSchema,sitesCurrentPresentationVersion,sitesCurrentPresentationSourceRevision}from'./packages/contracts/src/sites-presentation';
const params=new URLSearchParams(location.search),orientation=params.get('orientation'),long=params.has('long');
const rows=Array.from({length:Number(params.get('count'))},(_,index)=>({id:'row-'+index,column:index<Math.ceil(Number(params.get('count'))/2)?1:2,primary:long?'Een zeer lange producttitel die over meerdere regels moet afbreken zonder de prijs te overlappen':'Product '+(index+1),secondary:long?'Een uitgebreide omschrijving met ingrediënten en praktische informatie. '.repeat(20):'',value:index%2?'€ 12,50':'€ 2,50'}));
const presentation={kind:'dynamic',configuration:sitesDynamicConfigurationSchema.parse({schemaVersion:1,rendererVersion:sitesCurrentPresentationVersion,sourceRevision:sitesCurrentPresentationSourceRevision,provider:'menu',unifiedKind:'kantine',themeId:params.get('theme'),orientation,title:'Kantine',safeArea:4,scale:70,menuWidgets:true}),content:{kind:'kantine',title:'Kantine',subtitle:'',rows:[],menuPages:[{id:'chosen-page',columns:2,widgets:[{id:'drinks',type:'category',column:'full',columns:2,title:'Dranken',rows}]}]}};
createRoot(document.getElementById('root')).render(<SitesPresentationView presentation={presentation} fitViewport={true} onContentFit={overflow=>document.documentElement.dataset.overflow=String(overflow)}/>);
`;

test.beforeAll(() => {
  const build = `const {build}=require(${JSON.stringify(esbuild)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"'}});process.stdout.write(JSON.stringify(result.outputFiles[0].text));`;
  script = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${build}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 }));
});

async function mount(page: Page, orientation: string, theme: string, count: number, long = false) {
  await page.setViewportSize(orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
  await page.route("**/__menu-hotfix*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><head><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}*{box-sizing:border-box}</style></head><body><div id="root"></div><script>${script.replace(/<\/script/giu, "<\\/script")}</script></body></html>` }));
  await page.route(/\/(?:onzetrots|onzetrots-tv|onzetrots-approved-v1|fonts|fieldflow)\//u, route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", path)) });
  });
  await page.goto(`http://127.0.0.1:3343/__menu-hotfix?orientation=${orientation}&theme=${theme}&count=${count}${long ? "&long=1" : ""}`);
  await expect(page.locator(".vm-product")).toHaveCount(count);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator("html").getAttribute("data-overflow")).not.toBeNull();
}

for (const theme of ["fieldflow", "onzetrots-tv"]) {
  for (const orientation of ["landscape", "portrait"]) {
    for (const count of [13, 16]) test(`${theme} ${orientation}: ${count} compacte producten op één pagina`, async ({ page }) => {
      await mount(page, orientation, theme, count);
      await expect(page.locator("html")).toHaveAttribute("data-overflow", "false");
      await expect(page.locator(".vm-product strong").last()).toHaveText(`Product ${count}`);
      const alignment = await page.locator(".vm-product").first().evaluate(row => ({ display: getComputedStyle(row).display, alignment: getComputedStyle(row).alignItems }));
      expect(alignment).toEqual({ display: "grid", alignment: "baseline" });
    });
    test(`${theme} ${orientation}: overloop is zichtbaar meetbaar zonder producten te verwijderen`, async ({ page }) => {
      await mount(page, orientation, theme, 16, true);
      await expect(page.locator("html")).toHaveAttribute("data-overflow", "true");
      const metrics = await page.locator(".vm-product").first().evaluate(row => {
        const title = row.querySelector("strong")!;
        const price = row.querySelector("b")!;
        const range = document.createRange(); range.setStart(title.firstChild!, 0); range.setEnd(title.firstChild!, 1);
        const first = range.getBoundingClientRect();
        return { baselineDifference: Math.abs(first.bottom - price.getBoundingClientRect().bottom), overlap: title.getBoundingClientRect().right > price.getBoundingClientRect().left, nowrap: getComputedStyle(price).whiteSpace };
      });
      expect(metrics.baselineDifference).toBeLessThan(8);
      expect(metrics.overlap).toBe(false);
      expect(metrics.nowrap).toBe("nowrap");
      await page.screenshot({ path: `/tmp/castivo-hotfix-${theme}-${orientation}.png` });
    });
  }
}
