import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3313";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
// Render and hydrate the actual product module. Only Next's link transport and
// the server-provided fleet/advanced-slot data are controlled at this boundary.
const fixture = `import React from 'react';
import {SyncFleetView} from './apps/control/app/(shell)/dashboard/screens/sync-fleet-view';
const props={data:{screens:[],groups:[],releases:[]},screens:[],devices:new Map(),
 query:'',status:'all',group:'',setup:null,previews:new Map(),
 advanced:<nav aria-label="Groepsacties"><a href="/dashboard/screens/groups">Groepen beheren</a></nav>};
function Fixture(){React.useEffect(()=>{document.getElementById('root').dataset.hydrated='true'},[]);return <SyncFleetView {...props}/>}`;
let html: string;
let client: string;

test.beforeAll(() => {
  const build = String.raw`const{build}=require(${JSON.stringify(compiler)});
  const fixture=${JSON.stringify(fixture)};
  const plugins=[{name:'next-link-transport',setup(b){
    b.onResolve({filter:/^next\/link$/},()=>({path:'next/link',namespace:'next'}));
    b.onLoad({filter:/.*/,namespace:'next'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));
  }}];
  async function compile(suffix,platform,format){const result=await build({stdin:{contents:fixture+suffix,resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,platform,format,jsx:'automatic',plugins});return result.outputFiles[0].text}
  const server=await compile(';import{renderToString}from"react-dom/server";process.stdout.write(renderToString(<Fixture/>));','node','cjs');
  const html=require('child_process').execFileSync(process.execPath,[],{input:server,encoding:'utf8',maxBuffer:8*1024*1024});
  const client=await compile(';import{hydrateRoot}from"react-dom/client";window.__recoverable=[];hydrateRoot(document.getElementById("root"),<Fixture/>,{onRecoverableError:error=>window.__recoverable.push(error.message)});','browser','iife');
  process.stdout.write(JSON.stringify({html,client}));`;
  ({ html, client } = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${build}})().catch(error=>{console.error(error.message);process.exitCode=1})`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 })));
});

for (const earlyOpen of [true, false]) test(`native fleet details preserves ${earlyOpen ? "opening before hydration" : "closed server default"}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  let releaseClient!: () => void;
  const heldClient = new Promise<void>(resolve => { releaseClient = resolve; });
  await page.route(`${origin}/fleet.js`, async route => { await heldClient; await route.fulfill({ contentType: "application/javascript", body: client }); });
  await page.route(`${origin}/assets/full-light.svg`, route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await page.route(`${origin}/fleet`, route => route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Schermvloot</title></head><body><div id="root">${html}</div><script defer src="/fleet.js"></script></body></html>` }));
  // Holding the actual hydration script makes the observed CI ordering
  // deterministic; no readiness wait or console-message filtering hides it.
  await page.goto(`${origin}/fleet`, { waitUntil: "commit" });
  const details = page.locator("details.sync-fleet-advanced");
  const summary = details.locator("summary");
  await expect(details).not.toHaveAttribute("open");
  await expect(page.locator("#root")).not.toHaveAttribute("data-hydrated");
  const originalNode = await details.elementHandle();
  if (earlyOpen) {
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(page.getByRole("link", { name: "Groepen beheren" })).toBeVisible();
  }
  releaseClient();
  await expect(page.locator("#root")).toHaveAttribute("data-hydrated", "true");
  await test.info().attach("hydration-errors.json", { contentType: "application/json", body: JSON.stringify({ errors, recoverable: await page.evaluate(() => (window as unknown as { __recoverable: string[] }).__recoverable) }) });
  expect(await originalNode!.evaluate(element => element === document.querySelector("details.sync-fleet-advanced"))).toBe(true);
  if (earlyOpen) {
    await expect(details).toHaveAttribute("open", "");
    await summary.click();
    await expect(details).not.toHaveAttribute("open");
  } else await expect(details).not.toHaveAttribute("open");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(page.getByRole("link", { name: "Groepen beheren" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(details).not.toHaveAttribute("open");
  expect(await page.evaluate(() => (window as unknown as { __recoverable: string[] }).__recoverable)).toEqual([]);
  expect(errors).toEqual([]);
});
