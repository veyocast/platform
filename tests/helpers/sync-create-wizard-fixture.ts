import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createSyncStudioStarter } from "../../packages/studio/src/sync";
import { syncBackgroundAssets } from "../../packages/contracts/src/sync-background-catalog";
import {syncOnzeTrotsV9SystemAssets as syncOnzeTrotsSystemAssets} from '../../packages/contracts/src/sync-onzetrots-v9-assets';
import type { SyncCreateWizardCommand, SyncCreateWizardData } from "../../apps/control/app/(shell)/dashboard/studio/sync-create-wizard-types";
import { syncConnectedAuthoringType } from "../../apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding";

// Real four-step UI, Source renderer/CSS, fields and provider-selection controls.
// Only action/navigation transport is controlled; no live publication claim.
export const origin = "http://127.0.0.1:3387";
export const id = (n: number) => `23400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const require = createRequire(join(process.cwd(), "package.json"));
let bundle: { js: string; css: string };
export function prepareWizardFixture() {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SyncCreateWizard}from'./apps/control/app/(shell)/dashboard/studio/sync-create-wizard';function App(){const[data,setData]=useState(globalThis.fixture);globalThis.changeWizardData=setData;return <div className="sync-control app-shell" style={{display:'block',padding:'20px'}}><main id="control-content"><SyncCreateWizard data={data}/></main></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const actions = `async function request(path,input,scope){const r=await fetch('/__wizard/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,scope})});if(!r.ok)throw Error('Transport unavailable');return r.json()}export const createSyncDesignWizardAction=(v,s)=>request('create',v,s);export const loadSyncWizardSportlinkOptionsAction=(v,s)=>request('options',v,s);export const previewSyncWizardAction=(v,s)=>request('preview',v,s);export const readSyncEngageChoicesAction=v=>request('engage-choices',v);export const readSyncEngageSelectionAction=v=>request('engage-selection',v);export const readSyncYouTubeChoicesAction=v=>request('youtube-choices',v);`;
  const link = 'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}';
  const script = `const result=await require(${JSON.stringify(require.resolve("esbuild", { paths: [require.resolve("tsx")] }))}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transport',setup(b){b.onResolve({filter:/(sync-create-wizard-actions|sync-engage-actions|sync-youtube-actions)$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:${JSON.stringify(actions)},loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({resolveDir:process.cwd(),contents:${JSON.stringify(link)},loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)}}}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
}

export function fixture(family: SyncCreateWizardData["family"] = "welcome", connected = false): SyncCreateWizardData {
  return { tenantId: id(1), actorScope: `${id(1)}:${id(2)}`, tenantName: "Eigen club", family,
    initialPresentation: createSyncStudioStarter({ family, tenantName: "Eigen club", theme: "onzetrots-tv" }).syncPresentation!,
    canCreateManual: true, canCreateConnected: Boolean(syncConnectedAuthoringType(family)), initialMode: connected ? "connected" : "manual", slideType: syncConnectedAuthoringType(family) ?? null,
    sources: [{ id: id(3), name: "Eigen verenigingsbron", kind: "sportlink", providerStatus: "healthy", lastSuccessfulSyncAt: null, lastErrorCode: null }],
    templates: [{ versionId: id(4), orientation: "landscape", slug: "own" }, { versionId: id(5), orientation: "portrait", slug: "own-portrait" }],
    images: [{ id: id(20), title: "Eigen foto", checksumSha256: "a".repeat(64), url: `${origin}/assets/clubmuur-wall.webp` }], loadError: null,
  };
}
type Sent = { input: SyncCreateWizardCommand; scope: string };
export async function mount(page: Page, data = fixture(), opts: { dropFirst?: boolean; previewDenied?: boolean; delayedCreate?: boolean; rejectReplayOnce?: boolean; rssPreview?: boolean } = {}) {
  const creates: Sent[] = [], previews: unknown[] = [], reads: string[] = [], errors: string[] = [];
  const receipts = new Map<string, string>();
  let finishCreate: (() => Promise<void>) | null = null;
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => void dialog.accept());
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  // Resolve through the existing approved assets directory: ordinary local public
  // in a full checkout, canonical public behind the guarded assets link in sparse QA.
  const publicRoot = dirname(realpathSync(join(process.cwd(), "apps/control/public/assets")));
  await page.route(`${origin}/onzetrots-approved-v*/**`, route=>{
    const path=new URL(route.request().url()).pathname,asset=syncOnzeTrotsSystemAssets.find(asset=>asset.path===path);
    if(!asset)return route.abort();
    const bytes=readFileSync(join(publicRoot,path.slice(1)));
    expect(bytes.length).toBe(asset.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    return route.fulfill({body:bytes,contentType:asset.mimeType});
  });
  const backgrounds = new Map<string, Buffer>(syncBackgroundAssets.map(asset => {
    const source = join(publicRoot, asset.path.slice(1));
    if (realpathSync(source) !== source) throw Error(`Background is outside the canonical public directory: ${asset.path}`);
    const bytes = readFileSync(source);
    expect(bytes.length, asset.path).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex"), asset.path).toBe(asset.sha256);
    return [asset.path, bytes];
  }));
  await page.route(`${origin}/onzetrots/website-brush/*`, route => {
    const request = route.request(), url = new URL(request.url());
    const bytes = backgrounds.get(url.pathname);
    if (request.method() !== "GET" || url.origin !== origin || url.search || !bytes) return route.abort();
    return route.fulfill({ body: bytes, contentType: "image/webp" });
  });
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    try { return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" }); }
    catch { return route.abort(); }
  });
  await page.route(`${origin}/__wizard/*`, async route => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1)!, body = route.request().postDataJSON();
    if (path === "fixture") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nieuw ontwerp · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data)};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
    reads.push(path);
    if (path === "create") {
      creates.push(body);
      const nonce = body.input.kind === "manual" ? body.input.idempotencyKey : body.input.command.idempotencyKey;
      if (!receipts.has(nonce)) receipts.set(nonce, id(8));
      if (opts.dropFirst && creates.length === 1) return route.abort();
      if (opts.rejectReplayOnce && creates.length === 2) return route.fulfill({ json: { ok: false, rejected: true, error: "Je vereniging is tijdelijk gepauzeerd. Je invoer blijft behouden; probeer opnieuw wanneer je toegang is hersteld." } });
      const answer = () => route.fulfill({ json: { ok: true, href: `/dashboard/${body.input.kind === "manual" ? "studio" : "slides"}/${receipts.get(nonce)}` } });
      if (opts.delayedCreate) { finishCreate = answer; return; }
      return answer();
    }
    if (path === "options") return route.fulfill({ json: { ok: true, options: { sourceId: id(3), teams: [{ externalId: "own-team", name: "Eigen eerste team", contexts: [{ label: "Eigen competitie", competitionId: "comp", phaseId: "phase", poolId: "pool", seasonId: "season" }] }], capabilities: [], privacyPeople: true, privacyBirthdays: true } } });
    if (path === "preview") {
      previews.push(body);
      if (opts.previewDenied) return route.fulfill({ json: { ok: false, error: "De bronrechten zijn niet bevestigd. Je ontwerp blijft behouden; controleer Bronnen." } });
      if (opts.rssPreview) {
        const count = body.input.configuration.newsSelection?.maximumArticles ?? 30;
        return route.fulfill({ json: { ok: true, presentation: { ...body.input.configuration.syncConfiguration.seed, news: Array.from({ length: count }, (_, index) => ({ title: `Gecontroleerd artikel ${index + 1}`, intro: "Nieuws uit de gekozen testbron", source: "Eigen nieuwsbron", url: `https://example.org/article/${index}` })) }, assets: {}, source: { providerStatus: "ready", lastSuccessfulSyncAt: null, lastErrorCode: null } } });
      }
      return route.fulfill({ json: { ok: true, presentation: { ...body.input.configuration.syncConfiguration.seed, rows: [["1", "Eigen team", "4", "12"]] }, assets: {}, source: { providerStatus: "healthy", lastSuccessfulSyncAt: null, lastErrorCode: null } } });
    }
    if (path === "engage-choices") return route.fulfill({ json: { ok: true, choices: [{ id: id(31), title: "Eigen publieksvraag", status: "live" }], hasMore: false } });
    if (path === "engage-selection") return route.fulfill({ json: { ok: true, poll: { id: id(31), title: "Welke clubactiviteit kies jij?", status: "live", visibility: "live", options: [{ id: id(32), label: "Training", votes: 0 }, { id: id(33), label: "Toernooi", votes: 0 }], publicUrl: "https://example.org/poll/public-campaign" } } });
    if (path === "youtube-choices") return route.fulfill({ json: { ok: true, choices: [{ id: id(30), title: "Eigen gecontroleerde video", url: "https://www.youtube.com/watch?v=abcdefghijk" }], hasMore: false } });
    return route.abort();
  });
  await page.goto(`${origin}/__wizard/fixture`);
  await expect(page.getByRole("heading", { name: "Bron", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verder", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  return { creates, previews, reads, errors, receipts, finish: () => finishCreate?.() };
}
export async function next(page: Page) { await page.getByRole("button", { name: "Verder", exact: true }).click(); }
export async function toReview(page: Page) { await next(page); await next(page); await next(page); await expect(page.getByRole("heading", { name: "Controleren", exact: true })).toBeVisible(); }
