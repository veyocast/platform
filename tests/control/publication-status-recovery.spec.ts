import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let script = "";
const entry = `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{PublicationProgress,PublicationListRefresh}from'./apps/control/app/(shell)/dashboard/slides/publication-progress';
globalThis.publicationFixture={status:'publishing',reads:0,retries:0,refreshes:0,published:0,fail:false,hold:false};
const fixture=globalThis.publicationFixture;const onPublished=()=>{fixture.published++};
function App(){const[active,setActive]=useState(true);fixture.setActive=setActive;return active?(location.hash==='#list'?<PublicationListRefresh active={active}/>:<PublicationProgress slideId='30910000-0000-4000-8000-000000000001' onPublished={onPublished}/>):null}
createRoot(document.getElementById('root')).render(<App/>);
`;
const actions = `export async function readDynamicPublication(){const fixture=globalThis.publicationFixture;fixture.reads++;if(fixture.hold)await new Promise(resolve=>{fixture.resolve=resolve});if(fixture.fail)throw Error('controlled read outage');return {versionId:'30910000-0000-4000-8000-000000000002',revision:1,status:fixture.status,error:null,startedAt:null}};export async function publishDynamicSlideVersion(){globalThis.publicationFixture.retries++;return {ok:true,outcome:'publishing'}};`;

test.beforeAll(() => {
  const build = `const {build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules'],plugins:[{name:'controlled-publication-transport',setup(builder){builder.onResolve({filter:/version-actions$/},()=>({path:'actions',namespace:'controlled'}));builder.onResolve({filter:/^next\\/navigation$/},()=>({path:'router',namespace:'controlled'}));builder.onResolve({filter:/^@veyocast\\/ui$/},()=>({path:'button',namespace:'controlled'}));builder.onLoad({filter:/.*/,namespace:'controlled'},args=>({contents:args.path==='actions'?${JSON.stringify(actions)}:args.path==='router'?'const router={refresh(){globalThis.publicationFixture.refreshes++}};export const useRouter=()=>router;':'import React from"react";export function Button({children,...props}){return React.createElement("button",props,children)}',loader:'js',resolveDir:process.cwd()}));}}]});process.stdout.write(JSON.stringify(result.outputFiles[0].text));`;
  script = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${build}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 }));
});

type Fixture = { reads: number; retries: number; refreshes: number; published: number; status: string; fail: boolean; hold: boolean; resolve?: () => void; setActive: (active: boolean) => void };
declare global { var publicationFixture: Fixture; }

async function mount(page: Page, list = false) {
  await page.clock.install();
  await page.route("**/__publication-recovery", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><body><main id="root"></main><script>${script.replace(/<\/script/giu, "<\\/script")}</script></body></html>` }));
  await page.goto(`http://127.0.0.1:3343/__publication-recovery${list ? "#list" : ""}`);
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.publicationFixture?.setActive))).toBe(true);
}

test("a late confirmed publication clears the timeout automatically without publishing again", async ({ page }) => {
  await mount(page);
  await expect(page.getByRole("status")).toBeVisible();
  await page.clock.runFor(121_000);
  await expect(page.getByRole("alert")).toContainText("duurt te lang");
  await expect(page.getByRole("button", { name: "Publicatie opnieuw proberen" })).toBeVisible();
  const reads = await page.evaluate(() => globalThis.publicationFixture.reads);
  await page.evaluate(() => { globalThis.publicationFixture.status = "published"; });
  await page.clock.runFor(15_000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => ({ published: globalThis.publicationFixture.published, refreshes: globalThis.publicationFixture.refreshes, retries: globalThis.publicationFixture.retries, reads: globalThis.publicationFixture.reads }))).toEqual({ published: 1, refreshes: 1, retries: 0, reads: reads + 1 });
});

test("the dashboard keeps checking slowly after the warning and cancels on unmount", async ({ page }) => {
  await mount(page, true);
  await page.clock.runFor(121_000);
  await expect(page.getByRole("alert")).toContainText("duurt langer");
  const refreshes = await page.evaluate(() => globalThis.publicationFixture.refreshes);
  await page.clock.runFor(15_000);
  expect(await page.evaluate(() => globalThis.publicationFixture.refreshes)).toBe(refreshes + 1);
  await page.evaluate(() => globalThis.publicationFixture.setActive(false));
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.clock.runFor(60_000);
  expect(await page.evaluate(() => globalThis.publicationFixture.refreshes)).toBe(refreshes + 1);
});

test("a delayed status response cannot refresh an editor that has already closed", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { globalThis.publicationFixture.hold = true; });
  await page.clock.runFor(2_000);
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.publicationFixture.resolve))).toBe(true);
  await page.evaluate(() => globalThis.publicationFixture.setActive(false));
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.evaluate(() => { globalThis.publicationFixture.status = "published"; globalThis.publicationFixture.resolve!(); });
  await page.clock.runFor(30_000);
  expect(await page.evaluate(() => ({ published: globalThis.publicationFixture.published, refreshes: globalThis.publicationFixture.refreshes, retries: globalThis.publicationFixture.retries }))).toEqual({ published: 0, refreshes: 0, retries: 0 });
});

test("a temporary status outage recovers after the deadline without losing the saved version", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { globalThis.publicationFixture.fail = true; });
  await page.clock.runFor(121_000);
  await expect(page.getByRole("alert")).toContainText("opgeslagen versie blijft behouden");
  await page.evaluate(() => { globalThis.publicationFixture.fail = false; globalThis.publicationFixture.status = "published"; });
  await page.clock.runFor(15_000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => ({ published: globalThis.publicationFixture.published, retries: globalThis.publicationFixture.retries }))).toEqual({ published: 1, retries: 0 });
});
