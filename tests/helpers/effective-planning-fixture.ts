import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const planningOrigin = "http://127.0.0.1:3398";
export const planningFixture = JSON.parse(readFileSync("tests/fixtures/s298-effective-planning.json", "utf8"));
let bundle: { js: string; css: string };

export function prepareEffectivePlanningFixture() {
  const require = createRequire(join(process.cwd(), "package.json"));
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{EffectivePlanningView}from'./apps/control/app/(shell)/dashboard/planning/effective-planning-view';import{PublicationPlanningPreview}from'./apps/control/app/(shell)/dashboard/planning/publication-planning-preview';import{ScheduleOutcomePreview}from'./apps/control/app/(shell)/dashboard/planning/schedule-outcome-preview';const f=globalThis.fixture;function App(){const[selected,setSelected]=useState(f.current.screens[0].screenId);const mode=new URLSearchParams(location.search).get('mode');return <main className='sync-control px-pages' id='control-content'><h1>Planning bekijken</h1>{mode==='publication'?<><label>Scherm<select value={selected} onChange={e=>setSelected(e.target.value)}>{f.proposal.screens.map(s=><option key={s.screenId} value={s.screenId}>{s.name}</option>)}</select></label><PublicationPlanningPreview screenIds={[selected]} playlistId={f.current.screens[0].winner.playlistId}/></>:mode==='schedule'?<form id='proposal'><input type='hidden' name='name' value='Voorgenomen overname'/><ScheduleOutcomePreview readForm={()=>new FormData(document.getElementById('proposal'))}/></form>:<EffectivePlanningView report={f.current}/>}</main>}createRoot(document.getElementById('root')).render(<App/>);`;
  const mocks = {
    "next/link": "import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}",
    "effective-planning-actions": "async function preview(kind,input){const response=await fetch('/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,input})});if(!response.ok)throw Error('Read transport failed');return response.json()}export function previewDefaultPublication(input){return preview('publication',input)}export function previewScheduleProposal(input){return preview('schedule',Object.fromEntries(input))}"
  };
  const program = `const{build}=require(${JSON.stringify(compiler)});const mocks=${JSON.stringify(mocks)};const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},bundle:true,write:false,outfile:'planning.js',platform:'browser',format:'esm',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'planning-read-transport',setup(b){b.onResolve({filter:/.*/},a=>{const key=Object.keys(mocks).find(k=>a.path===k||a.path.endsWith('/'+k));return key?{path:key,namespace:'fixture'}:undefined});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}))}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${program}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }));
}

export async function mountEffectivePlanning(page: Page, mode = "current") {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${planningOrigin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : "image/svg+xml" });
  });
  await page.route(`${planningOrigin}/dashboard**`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Effectieve planning · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(planningFixture)}</script><script type="module">${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${planningOrigin}/dashboard/planning/effectief?mode=${mode}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { errors };
}
