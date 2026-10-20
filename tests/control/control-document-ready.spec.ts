import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { PassThrough } from "node:stream";
import { expect, test, type ConsoleMessage, type Page, type TestInfo } from "@playwright/test";

// Real RootLayout and production Next-vendored React on both sides. Only CSS
// loading and the unrelated PWA registration effect cross a fixture boundary.
// The Node HTTP server holds real SSR bytes, without changing the browser DOM,
// React, the scheduler, time, network speed, or the server/client host tree.
const rootRequire = createRequire(join(process.cwd(), "package.json"));
const compiler = rootRequire.resolve("esbuild", { paths: [rootRequire.resolve("tsx")] });
const nextRoot = process.env.S250_NEXT_PACKAGE ?? dirname(rootRequire.resolve("next/package.json", { paths: [join(process.cwd(), "apps/control")] }));
const scratchParent = process.env.S250_FIXTURE_OUTPUT ?? join(process.env.TMPDIR ?? "/tmp", "veyocast-s250-stream-fixture");
let scratch: string;
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

type Render = { output: PassThrough; release: () => void; errors: string[] };
type Runtime = { createFixtureStream: (suspense: boolean) => Render; version: string };
type Observation = {
  attempts: number;
  committed: number;
  errors: string[];
  fatal: string[];
  started: string;
  dcl: null | { pendingSegments: number; fallback: boolean };
  version: string;
  hydrationCalls: number;
  hostProbe: boolean;
  outside: string | null;
};

let server: Server;
let origin: string;
let runtime: Runtime;
let client: string;
let completeHtml: string;
let nodeSchedulerContract: Array<{ mode: string; callbackReadyState: string; callbackCalls: number; beforeRelease: number }>;
const pending = new Map<string, () => void>();
const pendingHead = new Map<string, () => void>();
const requests: Array<{ method: string; path: string }> = [];
const serverErrors: string[] = [];

// Witness renders before RootLayout and emits no host nodes. It proves a real
// concurrent React render was attempted while the HTTP response is still open.
const tree = `
import React,{Suspense,useEffect,useState}from'react';
import RootLayout from'./apps/control/app/layout';
function Witness(){if(typeof window!=='undefined')window.__stream.attempts++;return null}
function Tail({read,mismatch}){read();const Tag=mismatch?'article':'section';return <Tag id="stream-tail"><h2>Volledige serverinhoud</h2><p>Dezelfde uiteindelijke server- en clientboom.</p></Tag>}
function Body({suspense,mismatch,read}){const[count,setCount]=useState(0);useEffect(()=>{window.__stream.committed++},[]);return <main id="fixture-main"><h1>Gestreamd Control-document</h1><button id="server-button" type="button" onClick={()=>setCount(n=>n+1)}>Bediening {count}</button><script dangerouslySetInnerHTML={{__html:'window.__serverButton=document.getElementById("server-button");window.__serverMain=document.getElementById("fixture-main");window.__serverMeta=document.getElementById("head-metadata");window.__serverStylesheet=document.getElementById("head-stylesheet");'}}/>{suspense?<Suspense fallback={<p id="stream-fallback">Serverinhoud wordt aangevuld</p>}><Tail read={read} mismatch={mismatch}/></Suspense>:<Tail read={read} mismatch={mismatch}/>}</main>}
// AppRouter's head/metadata nodes precede content outside the root-layout gate.
function Fixture({suspense=false,mismatch=false,read=()=>{}}){return <><Witness/><meta id="head-metadata" name="control-stream-transport" content="same-server-client"/><link id="head-stylesheet" rel="stylesheet" href="/fixture.css" precedence="fixture"/><RootLayout><title>Control-streamproef</title><script src="/client.js" async/><Body suspense={suspense} mismatch={mismatch} read={read}/></RootLayout></>}
`;

function compile(entry: string, platform: "node" | "browser") {
  const script = `const{build}=require(${JSON.stringify(compiler)});(async()=>{const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:${JSON.stringify(platform)},format:${JSON.stringify(platform === "node" ? "cjs" : "iife")},jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'next':${JSON.stringify(nextRoot)},'react':${JSON.stringify(join(nextRoot, "dist/compiled/react"))},'react-dom':${JSON.stringify(join(nextRoot, "dist/compiled/react-dom"))}},plugins:[{name:'document-fixture-boundaries',setup(b){b.onResolve({filter:/\\.css$/},a=>({path:a.path,namespace:'css-boundary'}));b.onLoad({filter:/.*/,namespace:'css-boundary'},()=>({contents:'',loader:'js'}));b.onResolve({filter:/control-pwa-runtime$/},()=>({path:'pwa',namespace:'pwa-boundary'}));b.onLoad({filter:/.*/,namespace:'pwa-boundary'},()=>({contents:'export function ControlPwaRuntime(){return null}',loader:'js'}));}}]});process.stdout.write(result.outputFiles[0].text)})().catch(error=>{console.error(error);process.exitCode=1});`;
  return execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
}

test.beforeAll(async () => {
  mkdirSync(scratchParent, { recursive: true });
  scratch = mkdtempSync(join(scratchParent, `worker-${process.env.TEST_WORKER_INDEX ?? "0"}-`));
  const serverBundle = compile(`${tree}
import{PassThrough}from'node:stream';import{renderToPipeableStream}from'react-dom/server.node';
export const version=React.version;
export function createFixtureStream(suspense){let ready=!suspense,resolve;const waiting=new Promise(r=>{resolve=r}),output=new PassThrough(),errors=[];const read=()=>{if(!ready)throw waiting};const stream=renderToPipeableStream(<Fixture suspense={suspense} read={read}/>,{onShellReady(){stream.pipe(output)},onError(error){errors.push(String(error.message))}});return{output,errors,release(){ready=true;resolve()}}}
`, "node");
  const serverFile = join(scratch, "server.cjs");
  writeFileSync(serverFile, serverBundle);
  runtime = rootRequire(serverFile) as Runtime;
  client = compile(`${tree}
import{startTransition}from'react';import{hydrateRoot}from'react-dom/client';
import{unstable_scheduleCallback,unstable_NormalPriority}from'next/dist/compiled/scheduler';
window.__stream={attempts:0,committed:0,errors:[],fatal:[],started:null,dcl:null,version:React.version,hydrationCalls:0,hostProbe:false,outside:null};
window.addEventListener('error',event=>window.__stream.fatal.push(event.message));
document.addEventListener('DOMContentLoaded',()=>{window.__stream.dcl={pendingSegments:document.querySelectorAll('[hidden][id^="S:"]').length,fallback:!!document.getElementById('stream-fallback')}},{once:true});
const scenario=new URLSearchParams(location.search).get('scenario');
function start(){window.__stream.started=document.readyState;window.__stream.hydrationCalls++;startTransition(()=>hydrateRoot(document,<Fixture suspense={scenario==='suspense'} mismatch={scenario==='mismatch'}/>,{onRecoverableError:error=>window.__stream.errors.push(error.message)}));const probe=new MessageChannel();let turns=0;probe.port1.onmessage=()=>{if(++turns===2){window.__stream.hostProbe=true;console.debug('s250:host-turn-complete',JSON.stringify({readyState:document.readyState,hydrationCalls:window.__stream.hydrationCalls,attempts:window.__stream.attempts,bodyPresent:!!document.body}));probe.port1.close();probe.port2.close()}else probe.port2.postMessage(0)};probe.port2.postMessage(0)}
if(scenario==='outside'){unstable_scheduleCallback(unstable_NormalPriority,()=>{window.__stream.outside=document.readyState;console.debug('s250:outside-control-callback',JSON.stringify({readyState:document.readyState,bodyPresent:!!document.body}));return null})}else if(scenario==='complete'||scenario==='mismatch'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}else start();
`, "browser");
  writeFileSync(join(scratch, "client.js"), client);
  const full = runtime.createFixtureStream(false);
  const chunks: Buffer[] = [];
  for await (const chunk of full.output) chunks.push(Buffer.from(chunk));
  completeHtml = Buffer.concat(chunks).toString();
  expect(full.errors).toEqual([]);
  expect(completeHtml).toContain('<html data-veyocast-document-ready="1" data-design-system="fieldflow" lang="nl">');
  expect(completeHtml).toContain('<script src="/client.js" async=""></script>');
  expect(completeHtml.indexOf('<script src="/client.js"')).toBeLessThan(completeHtml.indexOf('<section id="stream-tail"'));
  writeFileSync(join(scratch, "complete-server.html"), completeHtml);
  writeFileSync(join(scratch, "framework-manifest.json"), JSON.stringify({
    nextVersion: JSON.parse(readFileSync(join(nextRoot, "package.json"), "utf8")).version,
    reactVersion: runtime.version,
    nodeEnv: "production",
    layoutSha: sha(readFileSync("apps/control/app/layout.tsx")),
    serverBundleSha: sha(serverBundle), clientBundleSha: sha(client), htmlSha: sha(completeHtml),
    productionRendererSha: sha(readFileSync(join(nextRoot, "dist/compiled/react-dom/cjs/react-dom-client.production.js"))),
    schedulerProductionSha: sha(readFileSync(join(nextRoot, "dist/compiled/scheduler/cjs/scheduler.production.js"))),
    schedulerDevelopmentSha: sha(readFileSync(join(nextRoot, "dist/compiled/scheduler/cjs/scheduler.development.js"))),
    boundaries: ["CSS imports omitted", "ControlPwaRuntime registration effect replaced by null"],
    hydration: "startTransition(() => hydrateRoot(document, actual RootLayout))"
  }, null, 2));
  const nodeBypass = ["production", "development"].map(mode => {
    const script = `const scheduler=require(${JSON.stringify(join(nextRoot, "dist/compiled/scheduler"))});if(typeof document!=='undefined')throw Error('Node bypass must have no document');scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority,()=>process.stdout.write('node-ssr-bypass'));`;
    const result = execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5_000, env: { ...process.env, NODE_ENV: mode } });
    expect(result).toBe("node-ssr-bypass");
    return { mode, result };
  });
  writeFileSync(join(scratch, "node-ssr-bypass.json"), JSON.stringify(nodeBypass, null, 2));
  nodeSchedulerContract = ["production", "development"].map(mode => {
    // Node's actual setImmediate queue is FIFO: the scheduler gets its first
    // host turn before the explicit release turn. No timer/time/React patch.
    const script = `const scheduler=require(${JSON.stringify(join(nextRoot, "dist/compiled/scheduler"))});global.document={readyState:'loading',documentElement:{getAttribute:name=>name==='data-veyocast-document-ready'?'1':null}};let callbackCalls=0,beforeRelease=-1,callbackReadyState;function flush(){if(callbackCalls&&beforeRelease>=0)process.stdout.write(JSON.stringify({callbackCalls,beforeRelease,callbackReadyState}))}scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority,()=>{callbackCalls++;callbackReadyState=document.readyState;flush()});setImmediate(()=>{beforeRelease=callbackCalls;document.readyState='complete';flush()});`;
    const result = execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5_000, env: { ...process.env, NODE_ENV: mode } });
    return { mode, ...JSON.parse(result) };
  });
  writeFileSync(join(scratch, "node-scheduler-parser-contract.json"), JSON.stringify(nodeSchedulerContract, null, 2));

  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push({ method: req.method ?? "", path: url.pathname });
    if (req.method !== "GET" || !["/fixture", "/client.js", "/fixture.css", "/favicon.ico"].includes(url.pathname)) {
      res.writeHead(405).end(); return;
    }
    if (url.pathname === "/client.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" }).end(client); return;
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204).end(); return; }
    if (url.pathname === "/fixture.css") { res.writeHead(200, { "Content-Type": "text/css" }).end("body{color:#17201a}"); return; }
    const scenario = url.searchParams.get("scenario") ?? "stream";
    const key = url.searchParams.get("key") ?? "";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    if (scenario === "suspense") {
      const rendered = runtime.createFixtureStream(true);
      pending.set(key, rendered.release);
      writeFileSync(join(scratch, `suspense-${key}.html`), "");
      rendered.output.on("data", chunk => writeFileSync(join(scratch, `suspense-${key}.html`), chunk, { flag: "a" }));
      rendered.output.on("end", () => serverErrors.push(...rendered.errors));
      rendered.output.pipe(res);
    } else if (scenario === "outside") {
      const html = completeHtml.replace(' data-veyocast-document-ready="1"', "");
      const split = html.indexOf('<meta id="head-metadata"');
      res.write(html.slice(0, split));
      pending.set(key, () => res.end(html.slice(split)));
    } else if (scenario === "stream") {
      const split = completeHtml.indexOf('<section id="stream-tail"');
      const headSplit = completeHtml.indexOf('<meta id="head-metadata"');
      if (headSplit < completeHtml.indexOf('<script src="/client.js"') || headSplit > completeHtml.indexOf("</head>")) {
        throw new Error("Head hold must follow the async client script and precede the remaining head/body");
      }
      res.write(completeHtml.slice(0, headSplit));
      pendingHead.set(key, () => { res.write(completeHtml.slice(headSplit, split)); pendingHead.delete(key); });
      pending.set(key, () => { pendingHead.get(key)?.(); res.end(completeHtml.slice(split)); });
    } else {
      res.end(completeHtml);
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture must bind loopback");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  for (const release of pending.values()) release();
  pending.clear();
  pendingHead.clear();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  expect(serverErrors).toEqual([]);
  expect(requests.every(request => request.method === "GET")).toBe(true);
});

async function observation(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as { __stream: Observation }).__stream;
    return { ...state, readyState: document.readyState,
      buttonRetained: document.getElementById("server-button") === (window as unknown as { __serverButton: Element }).__serverButton,
      mainRetained: document.getElementById("fixture-main") === (window as unknown as { __serverMain: Element }).__serverMain,
      metadataRetained: document.querySelector("meta[name=control-stream-transport]") === (window as unknown as { __serverMeta: Element }).__serverMeta,
      stylesheetRetained: document.querySelector('link[rel=stylesheet][href="/fixture.css"]') === (window as unknown as { __serverStylesheet: Element }).__serverStylesheet,
      metadataCount: document.querySelectorAll("meta[name=control-stream-transport]").length,
      stylesheetCount: document.querySelectorAll('link[rel=stylesheet][href="/fixture.css"]').length };
  });
}

async function evidence(page: Page, info: TestInfo, extra: unknown) {
  const result = { state: await observation(page), extra, requests: [...requests] };
  await info.attach("document-stream-evidence", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
}

async function exercise(page: Page, info: TestInfo, scenario: "stream" | "suspense" | "complete" | "mismatch") {
  const key = `${scenario}-${info.workerIndex}`;
  const browserErrors: string[] = [];
  const foreignRequests: string[] = [];
  const hostEvents: string[] = [];
  const hostTurn = Promise.race([
    page.waitForEvent("console", { predicate: message => message.text().startsWith("s250:host-turn-complete ") }),
    page.waitForEvent("pageerror")
  ]);
  const onPageError = (error: Error) => { browserErrors.push(error.message); };
  const onConsole = (message: ConsoleMessage) => {
    if (message.text().startsWith("s250:host-turn-complete ")) hostEvents.push(message.text());
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("request", request => { if (new URL(request.url()).origin !== origin) foreignRequests.push(new URL(request.url()).origin); });
  const navigation = page.goto(`${origin}/fixture?scenario=${scenario}&key=${key}`, { waitUntil: "load" });
  let partial: unknown = null;
  let headPartial: unknown = null;
  try {
    if (scenario === "stream" || scenario === "suspense") {
      // A head-only document has no rendering/liveness guarantee. Observe a
      // native host event directly in Node; do not poll through RAF here.
      await hostTurn;
      if (scenario === "stream") {
        headPartial = await page.evaluate(() => ({ readyState: document.readyState,
          committed: (window as unknown as { __stream: Observation }).__stream.committed,
          hydrationCalls: (window as unknown as { __stream: Observation }).__stream.hydrationCalls,
          hostProbe: (window as unknown as { __stream: Observation }).__stream.hostProbe,
          attempted: (window as unknown as { __stream: Observation }).__stream.attempts,
          fatal: (window as unknown as { __stream: Observation }).__stream.fatal,
          bodyPresent: !!document.body, metadataCount: document.querySelectorAll("meta[name=control-stream-transport]").length,
          stylesheetCount: document.querySelectorAll('link[rel=stylesheet][href="/fixture.css"]').length }));
        expect((await observation(page)).fatal).toEqual([]);
        const releaseHead = pendingHead.get(key);
        if (!releaseHead) throw new Error("Partial head must have an explicit server-side release");
        releaseHead();
        await page.waitForFunction(() => !!(window as unknown as { __serverButton?: Element }).__serverButton);
        await page.evaluate(async () => {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        });
      }
      partial = await page.evaluate(() => ({ readyState: document.readyState,
        committed: (window as unknown as { __stream: Observation }).__stream.committed,
        visibleServerButton: !!document.getElementById("server-button"),
        tailPresent: !!document.getElementById("stream-tail"),
        fallbackPresent: !!document.getElementById("stream-fallback") }));
      const release = pending.get(key);
      if (!release) throw new Error("Open stream must have an explicit server-side release");
      release(); pending.delete(key);
    }
    await navigation;
    await expect.poll(async () => (await observation(page)).committed).toBeGreaterThan(0);
    if (scenario === "mismatch") {
      await expect.poll(async () => (await observation(page)).errors.length).toBeGreaterThan(0);
      expect((await observation(page)).errors.some(message => /#418\b/.test(message))).toBe(true);
      expect((await observation(page)).started).not.toBe("loading");
      expect((await observation(page)).buttonRetained).toBe(false);
      await expect(page.locator("article#stream-tail")).toBeVisible();
    } else {
      await expect(page.locator("section#stream-tail")).toBeVisible();
      const final = await observation(page);
      expect(final.errors).toEqual([]);
      expect(final.buttonRetained).toBe(true);
      expect(final.mainRetained).toBe(true);
      expect(final.metadataRetained).toBe(true);
      expect(final.stylesheetRetained).toBe(true);
      expect(final.metadataCount).toBe(1);
      expect(final.stylesheetCount).toBe(1);
      expect(final.version).toBe(runtime.version);
      if (scenario === "stream") {
        expect(nodeSchedulerContract).toEqual(["production", "development"].map(mode => ({ mode, beforeRelease: 0, callbackCalls: 1, callbackReadyState: "complete" })));
      }
      if (scenario === "stream" || scenario === "suspense") {
        expect(partial).toMatchObject({ readyState: "loading", committed: 0, visibleServerButton: true, tailPresent: false });
        expect(final.started).toBe("loading");
        if (scenario === "stream") {
          expect(headPartial).toMatchObject({ readyState: "loading", hydrationCalls: 1, hostProbe: true, attempted: 0, committed: 0, bodyPresent: false, metadataCount: 0, stylesheetCount: 1 });
        }
      } else {
        expect(final.started).not.toBe("loading");
      }
      if (scenario === "suspense") {
        expect(partial).toMatchObject({ fallbackPresent: true });
        const streamedHtml = readFileSync(join(scratch, `suspense-${key}.html`), "utf8");
        expect(streamedHtml).toContain("$RC(");
        expect(streamedHtml).toContain('id="S:0"');
        expect(final.dcl).not.toBeNull();
        expect(final.dcl?.pendingSegments).toBeGreaterThan(0);
        expect(final.dcl?.fallback).toBe(true);
      }
    }
    await page.getByRole("button", { name: "Bediening 0", exact: true }).click();
    await expect(page.getByRole("button", { name: "Bediening 1", exact: true })).toBeVisible();
    expect(browserErrors).toEqual([]);
    expect(foreignRequests).toEqual([]);
  } finally {
    page.removeListener("pageerror", onPageError);
    page.removeListener("console", onConsole);
    pending.get(key)?.(); pending.delete(key);
    await navigation.catch(() => undefined);
    if (!page.isClosed()) {
      await evidence(page, info, { scenario, headPartial, partial, hostEvents, browserErrors, foreignRequests });
    } else {
      await info.attach("document-stream-closed-context", { body: JSON.stringify({ scenario, headPartial, partial, hostEvents, browserErrors, foreignRequests, boundary: "Context closed before final DOM observation" }), contentType: "application/json" });
    }
  }
}

async function outsideControl(page: Page, info: TestInfo) {
  const key = `outside-${info.workerIndex}`;
  const callback = page.waitForEvent("console", { predicate: message => message.text().startsWith("s250:outside-control-callback ") });
  const navigation = page.goto(`${origin}/fixture?scenario=outside&key=${key}`, { waitUntil: "load" });
  try {
    await callback;
    const state = await page.evaluate(() => ({
      callbackState: (window as unknown as { __stream: Observation }).__stream.outside,
      readyState: document.readyState, bodyPresent: !!document.body,
      controlOptIn: document.documentElement.hasAttribute("data-veyocast-document-ready")
    }));
    expect(state).toEqual({ callbackState: "loading", readyState: "loading", bodyPresent: false, controlOptIn: false });
    await info.attach("outside-control-scheduler-bypass", { body: JSON.stringify(state), contentType: "application/json" });
  } finally {
    pending.get(key)?.(); pending.delete(key);
    await navigation;
  }
}

test("whole-document stream retains visible SSR nodes while concurrent hydration waits for the parser", async ({ page }, info) => {
  await exercise(page, info, "stream");
});

test("real streamed Suspense/Fizz content completes without replacing the server shell", async ({ page }, info) => {
  await exercise(page, info, "suspense");
});

test("a document already parsed before hydration keeps its SSR nodes and becomes interactive", async ({ page }, info) => {
  await exercise(page, info, "complete");
  await outsideControl(page, info);
});

test("a genuine structural mismatch after DOMContentLoaded remains reported", async ({ page }, info) => {
  await exercise(page, info, "mismatch");
});

// Playwright requires fixture destructuring; this Node-only test needs no page.
// eslint-disable-next-line no-empty-pattern
test("pending Fizz reveals defer Control callbacks after parsing without delaying other documents", async ({}, info) => {
  const cases = ["control-pending", "control-empty", "other-pending", "other-loading", "control-no-window", "control-null-window"] as const;
  const results: Array<{ mode: string; scenario: string; beforeRelease: number; callbackCalls: number; callbackReadyState: string; callbackQueueLength: number | null }> = [];
  for (const mode of ["production", "development"]) {
    for (const scenario of cases) {
      // Execute the actual public Scheduler. Node's FIFO host turns expose an
      // early callback deterministically; no Scheduler/timer/RAF API is replaced.
      // This document/window stub tests the callback contract, not Next hydration.
      const script = `const scheduler=require(${JSON.stringify(join(nextRoot, "dist/compiled/scheduler"))});
const scenario=${JSON.stringify(scenario)},control=scenario.startsWith('control-');
global.document={readyState:scenario==='other-loading'?'loading':'complete',documentElement:{getAttribute:name=>name==='data-veyocast-document-ready'&&control?'1':null}};
if(scenario==='control-null-window')global.window=null;else if(scenario!=='control-no-window')global.window={$RB:scenario==='control-empty'?[]:[{},{}]};
let callbackCalls=0,beforeRelease=-1,callbackReadyState,callbackQueueLength;
function emit(){if(callbackCalls&&beforeRelease>=0)process.stdout.write(JSON.stringify({beforeRelease,callbackCalls,callbackReadyState,callbackQueueLength}))}
scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority,()=>{callbackCalls++;callbackReadyState=document.readyState;callbackQueueLength=Array.isArray(global.window?.$RB)?global.window.$RB.length:null;emit()});
setImmediate(()=>{beforeRelease=callbackCalls;if(Array.isArray(global.window?.$RB))global.window.$RB.length=0;emit()});`;
      const output = execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5_000, env: { ...process.env, NODE_ENV: mode } });
      results.push({ mode, scenario, ...JSON.parse(output) });
    }
  }
  await info.attach("parsed-document-reveal-scheduler-contract", { body: JSON.stringify({ documentWindowStub: true, results }, null, 2), contentType: "application/json" });
  expect(results).toEqual(["production", "development"].flatMap(mode => cases.map(scenario => ({
    mode, scenario, beforeRelease: scenario === "control-pending" ? 0 : 1, callbackCalls: 1,
    callbackReadyState: scenario === "other-loading" ? "loading" : "complete",
    callbackQueueLength: scenario === "control-no-window" || scenario === "control-null-window" ? null : scenario.startsWith("other-") ? 2 : 0
  }))));
});

// eslint-disable-next-line no-empty-pattern
test("interactive Control with an empty Fizz queue waits for document completion", async ({}, info) => {
  const results: Array<{ mode: string; control: boolean; beforeComplete: number; calls: number; readyState: string }> = [];
  for (const mode of ["production", "development"]) {
    for (const control of [true, false]) {
      const script = `const scheduler=require(${JSON.stringify(join(nextRoot, "dist/compiled/scheduler"))});
global.document={readyState:'interactive',documentElement:{getAttribute:name=>name==='data-veyocast-document-ready'&&${control}?'1':null}};global.window={$RB:[]};
let calls=0,beforeComplete=-1,readyState;
function emit(){if(calls&&beforeComplete>=0)process.stdout.write(JSON.stringify({calls,beforeComplete,readyState}))}
scheduler.unstable_scheduleCallback(scheduler.unstable_NormalPriority,()=>{calls++;readyState=document.readyState;emit()});
setImmediate(()=>{beforeComplete=calls;document.readyState='complete';emit()});`;
      const output = execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5_000, env: { ...process.env, NODE_ENV: mode } });
      results.push({ mode, control, ...JSON.parse(output) });
    }
  }
  await info.attach("interactive-empty-queue-completion-contract", { body: JSON.stringify({ documentWindowStub: true, results }, null, 2), contentType: "application/json" });
  expect(results).toEqual(["production", "development"].flatMap(mode => [true, false].map(control => ({ mode, control, beforeComplete: control ? 0 : 1, calls: 1, readyState: control ? "complete" : "interactive" }))));
});
