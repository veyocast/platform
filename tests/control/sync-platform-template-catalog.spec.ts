import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Real async page/components/CSS. Only session, database transport and Next host
// are controlled. No live Auth/RLS or provider acceptance follows from this fixture.
const origin = "http://127.0.0.1:3374";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let fixture: { pages: Record<string, string>; css: string; calls: Array<Record<string, unknown>> };

test.beforeAll(() => {
  const variants = ["", "?page=1", "?page=2", "?page=99999", "?page=-1", "?q=Zaal&status=", "?q=&status=published", "?q=Geen&status=", "?q=FAILCOUNT", "?q=FAILLIST", "?q=FAILVERSIONS", "?q=100%25_", "?q=READONLY"];
  const entry = `import React from'react';import{renderToReadableStream}from'react-dom/server';import Page from'./apps/control/app/(shell)/platform/templates/page';export async function render(){globalThis.calls=[];const pages={};for(const suffix of ${JSON.stringify(variants)}){const params=Object.fromEntries(new URLSearchParams(suffix));globalThis.fixtureParams=params;const page=await Page({searchParams:Promise.resolve(params)});pages[suffix]=await new Response(await renderToReadableStream(<div className="sync-control app-shell" style={{display:"block"}}><main id="control-content" style={{padding:16}}>{page}</main></div>)).text()}return{pages,calls:globalThis.calls}}`;
  const database = `export async function createControlSupabaseClient(){const p=globalThis.fixtureParams;return{from(table){if(!['dynamic_templates','dynamic_template_versions'].includes(table))throw Error('Unexpected table '+table);const state={table,head:false,filters:[],orders:[],range:null,ids:[]};const q={select(fields,options){state.fields=fields;state.head=options?.head===true;state.count=options?.count;return q},ilike(column,value){if(column!=='name')throw Error('Unexpected search');state.filters.push([column,value]);return q},eq(column,value){if(column!=='status')throw Error('Unexpected filter');state.filters.push([column,value]);return q},order(column,options){state.orders.push([column,options]);return q},range(start,end){if(end-start!==19||start<0)throw Error('Unbounded page');state.range=[start,end];return q},in(column,ids){if(table!=='dynamic_template_versions'||column!=='id'||ids.length>20)throw Error('Unbounded versions');state.ids=ids;return q},then(resolve,reject){globalThis.calls.push({params:{...p},...state});let rows=Array.from({length:45},(_,index)=>({id:'template-'+(index+1),name:index===20?'Zaalvoorstelling':'Template '+String(index+1).padStart(2,'0'),description:'Eigen gecontroleerde template',orientation:index%2?'portrait':'landscape',slide_type:index%2?'menu':'news',status:index%3?'draft':'published',updated_at:'2026-10-20T00:00:00Z',current_published_version_id:index%3?null:'version-'+(index+1)}));if(!p.q?.startsWith('FAIL')&&p.q!=='READONLY'){const literal=(p.q??'').toLowerCase();rows=rows.filter(x=>x.name.toLowerCase().includes(literal));}if(p.status)rows=rows.filter(x=>x.status===p.status);let result;if((state.head&&p.q==='FAILCOUNT')||(!state.head&&table==='dynamic_templates'&&p.q==='FAILLIST')||(table==='dynamic_template_versions'&&p.q==='FAILVERSIONS'))result={data:null,count:null,error:{message:'Controlled read failure'}};else if(table==='dynamic_template_versions')result={data:state.ids.map(id=>({id,version:3})),error:null};else if(state.head){if(state.count!=='exact')throw Error('Missing exact count');result={data:null,error:null,count:rows.length};}else{if(!state.range)throw Error('Missing range');if(JSON.stringify(state.orders)!==JSON.stringify([['updated_at',{ascending:false}],['id',{ascending:true}]]))throw Error('Unstable ordering');result={data:rows.slice(state.range[0],state.range[1]+1),error:null};}return Promise.resolve(result).then(resolve,reject)}};return q}}}`;
  const session = `export async function requireControlCapability(capability){if(capability!=='platform.dynamic_template.read')throw Error('Changed permission');return{isLive:true,capabilities:globalThis.fixtureParams.q==='READONLY'?['platform.dynamic_template.read']:['platform.dynamic_template.read','platform.dynamic_template.write']}}`;
  const host = `import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`;
  const script = String.raw`(async()=>{const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'catalog.js',platform:'node',format:'cjs',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'readonly-catalog-boundaries',setup(b){b.onResolve({filter:/\/lib\/control-session$/},()=>({path:'session',namespace:'controlled'}));b.onResolve({filter:/\/lib\/supabase\/server$/},()=>({path:'database',namespace:'controlled'}));b.onResolve({filter:/^next\/link$/},()=>({path:'host',namespace:'controlled'}));b.onLoad({filter:/.*/,namespace:'controlled'},a=>({contents:a.path==='session'?${JSON.stringify(session)}:a.path==='database'?${JSON.stringify(database)}:${JSON.stringify(host)},loader:'js',resolveDir:process.cwd()}))}}]});const m={exports:{}};new Function('require','module','exports',result.outputFiles.find(f=>f.path.endsWith('.js')).text)(require,m,m.exports);process.stdout.write(JSON.stringify({...await m.exports.render(),css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));})().catch(error=>{console.error(error);process.exitCode=1})`;
  fixture = JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 }));
});

for (const width of [390, 1440]) {
  test(`bounded platform template catalogue keeps search, all pages and readable rows at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
    await page.route(`${origin}/assets/*`, route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: "font/woff2" });
    });
    await page.route(`${origin}/platform/templates*`, route => {
      if (route.request().method() !== "GET") writes.push(route.request().method());
      const suffix = new URL(route.request().url()).search;
      if (!(suffix in fixture.pages)) throw Error(`Unexpected native query ${suffix}`);
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Templatecatalogus</title><style>${css}\n${fixture.css}</style></head><body>${fixture.pages[suffix]}</body></html>` });
    });
    const facts = [];
    const inspect = async (expectedRows: number) => {
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("tbody tr")).toHaveCount(expectedRows);
      const geometry = await page.locator("html,.vc-data-table-frame").evaluateAll(nodes => nodes.map(n => ({ tag: n.tagName, client: n.clientWidth, scroll: n.scrollWidth })));
      expect(geometry.every(n => n.client === n.scroll)).toBe(true);
      for (const field of [page.getByLabel("Zoeken op naam"), page.getByLabel("Status", { exact: true })]) {
        await expect(field).toHaveCSS("font-size", "14px");
        expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const cells = await page.locator("tbody tr").first().locator("td").evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect();return { y:r.y, width:r.width }; }));
      if (width === 390) {
        expect(cells[0]!.width).toBeGreaterThan(cells[1]!.width);
        expect(cells[1]!.y).toBe(cells[2]!.y);
      }
      facts.push({ url: new URL(page.url()).search, rows: expectedRows, geometry, cells });
    };
    await page.goto(origin + "/platform/templates");
    await inspect(20);
    await expect(page.getByRole("link", { name: "Nieuw template", exact: true })).toHaveAttribute("href", "/platform/templates/new");
    await expect(page.getByRole("link", { name: "Nieuw template", exact: true })).toHaveCSS("background-color", "rgb(0, 109, 115)");
    await expect(page.getByRole("columnheader")).toHaveText(["Template", "Vorm", "Status en versie"]);
    await expect(page.getByRole("link", { name: "Template en versies openen: Template 01", exact: true })).toHaveAttribute("href", "/platform/templates/template-1");
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach("catalogue.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await info.attach("catalogue-viewport.png", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("link", { name: "Volgende", exact: true }).click();
    await inspect(20);
    await expect(page.getByRole("link", { name: "Template en versies openen: Zaalvoorstelling", exact: true })).toHaveAttribute("href", "/platform/templates/template-21");
    await page.getByRole("link", { name: "Vorige", exact: true }).click();
    await expect(page).toHaveURL(origin + "/platform/templates?page=1");
    await page.goto(origin + "/platform/templates");
    await page.getByLabel("Zoeken op naam").fill("Zaal");
    await page.getByRole("button", { name: "Zoeken", exact: true }).click();
    await inspect(1);
    await expect(page).toHaveURL(origin + "/platform/templates?q=Zaal&status=");
    await page.getByLabel("Zoeken op naam").fill("");
    await page.getByLabel("Status", { exact: true }).selectOption("published");
    await page.getByRole("button", { name: "Zoeken", exact: true }).click();
    await inspect(15);
    await page.goto(origin + "/platform/templates?page=99999");
    await inspect(5);
    await expect(page.getByText("Pagina 3 van 3", { exact: true })).toBeVisible();
    await page.goto(origin + "/platform/templates?page=-1");
    await inspect(20);
    await page.goto(origin + "/platform/templates?q=Geen&status=");
    await expect(page.getByText("Geen templates gevonden. Pas je zoekopdracht of statusfilter aan.", { exact: true })).toBeVisible();
    for (const failure of ["FAILCOUNT", "FAILLIST", "FAILVERSIONS"]) {
      await page.goto(origin + "/platform/templates?q=" + failure);
      await expect(page.getByRole("alert")).toContainText("De templates konden niet worden geladen.");
      await expect(page.locator("tbody tr")).toHaveCount(0);
      await expect(page.getByText("Er zijn nog geen platformtemplates.", { exact: true })).toHaveCount(0);
    }
    await page.goto(origin + "/platform/templates?q=READONLY");
    await expect(page.getByRole("link", { name: "Nieuw template", exact: true })).toHaveCount(0);
    await inspect(20);
    const escaped = fixture.calls.filter(call => (call.params as { q?: string }).q === "100%_");
    expect(escaped).toHaveLength(1);
    expect(escaped[0]!.filters).toEqual([["name", "%100\\%\\_%"]]);
    expect(fixture.calls.filter(call => call.table === "dynamic_templates" && !call.head).every(call => Array.isArray(call.range) && call.range[1] - call.range[0] === 19)).toBe(true);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("catalogue-readback.json", { body: JSON.stringify({ width, facts, calls: fixture.calls }), contentType: "application/json" });
  });
}
