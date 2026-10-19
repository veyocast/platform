import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { syncBackgroundScenes, type SyncDynamicCommand, type SyncDynamicRequest, type SyncDynamicConfiguration, type SyncContentFamily } from "@veyocast/contracts";
import { createSyncStudioStarter } from "../../packages/studio/src/sync";
import type { StudioDocument } from "../../packages/studio/src/schema";
import type { StudioSeriesDetail } from "../../apps/control/app/(shell)/dashboard/studio/types";
import type { SyncStudioSeriesCommand } from "../../apps/control/app/(shell)/dashboard/studio/sync-studio-series-command";
import { syncConnectedAuthoringType } from "../../apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding";

// Real saved controllers and shared picker. Only server transport is controlled;
// native SQL/worker acceptance is recorded separately.
async function galleryRoutes(page: Page, origin: string) {
  await page.route(origin + "/onzetrots/website-brush/*", route => {
    const path = new URL(route.request().url()).pathname;
    const asset = syncBackgroundScenes.flatMap(scene => [scene.landscape, scene.portrait]).find(asset => asset.path === path);
    return asset ? route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", asset.path)), contentType: asset.mimeType }) : route.abort();
  });
}

test.describe("saved manual background picker", () => {
const origin = "http://127.0.0.1:3313",
  require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", {
  paths: [require.resolve("tsx")],
});
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{SyncStudioEditor}from'./apps/control/app/(shell)/dashboard/studio/[designId]/sync-studio-editor';function App(){const[portal,setPortal]=useState(null);return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main className="main-content" id="control-content"><SyncStudioEditor {...globalThis.fixtureProps}/></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-commands',setup(b){b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'commands'}));b.onLoad({filter:/.*/,namespace:'commands'},a=>({contents:'async function post(path,input){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(!r.ok)throw Error("Transport unavailable");return r.json()};'+(a.path.includes('sync-youtube-actions')?'export const readSyncYouTubeChoicesAction=input=>post("/__sync-studio/youtube-choices",input);':a.path.includes('sync-engage-actions')?'export const readSyncEngageChoicesAction=input=>post("/__sync-studio/engage-choices",input);export const readSyncEngageSelectionAction=input=>post("/__sync-studio/engage-selection",input);':a.path.includes('sync-studio-series-actions')?'export const mutateSyncStudioSeriesAction=input=>post("/__sync-studio/series",input);':a.path.includes('sync-studio-actions')?'export const readSyncStudioDraftAction=input=>post("/__sync-studio/read",input);':a.path.includes('sites-placement-theme-actions')?'export const readStudioPlacementThemeRenderAction=input=>post("/__sync-studio/job",input);':'export const saveStudioDraftAction=input=>post("/__sync-studio/save",input);export const requestStudioRenderAction=input=>post("/__sync-studio/render",input);export const copyStudioConflictAction=input=>post("/__sync-studio/copy",input);export const restoreStudioRevisionAction=input=>post("/__sync-studio/restore",input);'),loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return {push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)},refresh:()=>{}}}',loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));}}]});const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text;const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Fixture build omitted JavaScript or CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(
    process.execPath,
    [
      "-e",
      `(async()=>{${code}})().catch(e=>{console.error(e.message);process.exitCode=1})`,
    ],
    { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
  ));
});
type Save = {
  projectId: string;
  expectedRevision: number;
  idempotencyKey: string;
  document: StudioDocument;
};
type Hooks = {
  dropFirstSave?: boolean;
  rejectFirstSave?: boolean;
  rejectRecoverySave?: boolean;
  failFirstRead?: boolean;
  failFirstJobRead?: boolean;
  viewer?: boolean;
  family?: "fixtures" | "youtube" | "engage";
  dropFirstRender?: boolean;
  dropFirstCopy?: boolean;
  dropFirstRestore?: boolean;
  failRestoreRead?: boolean;
  initialSeries?:boolean;
  dropFirstSeries?:boolean;
  rejectSeriesRecovery?:boolean;
};
async function mount(page: Page, hooks: Hooks = {}) {
  const document = createSyncStudioStarter({
    family: hooks.family ?? "fixtures",
    tenantName: "Club A",
  });
  if (document.syncPresentation?.family === "fixtures")
    document.syncPresentation.rows = [["Thuis A", "Uit B", "11:00", "2"]];
  const snapshot = structuredClone(document);
  snapshot.syncPresentation!.title = "Historische inhoud";
  const state:{document:StudioDocument;revision:number;series?:StudioSeriesDetail} = { document, revision: 1 },
    writes: Save[] = [],
    reads: unknown[] = [],
    renderWrites: unknown[] = [],
    copyWrites: unknown[] = [],
    restoreWrites: unknown[] = [],
    receipts = new Map<string, unknown>(),
    errors: string[] = [];
  const seriesWrites:SyncStudioSeriesCommand[]=[];
  if(hooks.initialSeries)state.series={id:'22600000-0000-4000-8000-000000000095',name:'Wedstrijddag',revision:1,items:[{id:'22600000-0000-4000-8000-000000000080',name:'Programma',order:0,draftRevision:1,document:structuredClone(document)},{id:'22600000-0000-4000-8000-000000000093',name:'Tweede ontwerp',order:1,draftRevision:1,document:structuredClone(document)}]};
  page.on("pageerror", (error) => errors.push(error.message));
  const styles = [
    "tokens/veyocast-design-tokens.css",
    "packages/ui/src/styles.css",
    "apps/control/app/globals.css",
    "apps/control/app/fieldflow.css",
    "apps/control/app/sync-source.css",
    "apps/control/app/sync-adapter.css",
  ]
    .map((path) => readFileSync(path, "utf8").replace(/@import[^;]+;/g, ""))
    .join("\n");
  await page.route(`${origin}/assets/*`, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    const contentType = name.endsWith("woff2")
      ? "font/woff2"
      : name.endsWith("ttf")
        ? "font/ttf"
        : "image/webp";
    return route.fulfill({
      body: readFileSync(
        join(process.cwd(), "apps/control/public/assets", name),
      ),
      contentType,
    });
  });
  await page.route(`${origin}/__sync-studio/save`, async (route) => {
    const input = route.request().postDataJSON() as Save;
    writes.push(input);
    if (
      (hooks.rejectFirstSave && writes.length === 1) ||
      (hooks.rejectRecoverySave && writes.length > 1)
    )
      return route.fulfill({
        json: {
          ok: false,
          rejected: true,
          error:
            "De database heeft deze poging afgewezen. Je invoer blijft behouden.",
        },
      });
    let receipt = receipts.get(input.idempotencyKey);
    if (!receipt) {
      if (input.expectedRevision !== state.revision)
        receipt = {
          ok: false,
          outcome: "conflict",
          actualRevision: state.revision,
          error: "Er is een nieuwere versie. Je invoer blijft behouden.",
        };
      else {
        state.document = structuredClone(input.document);
        state.revision++;
        receipt = { ok: true, outcome: "saved", revision: state.revision };
      }
      receipts.set(input.idempotencyKey, receipt);
    }
    if (hooks.dropFirstSave && writes.length === 1) return route.abort();
    return route.fulfill({ json: receipt });
  });
  await page.route(`${origin}/__sync-studio/read`, (route) => {
    reads.push(route.request().postDataJSON());
    if (
      (hooks.failFirstRead && reads.length === 1) ||
      (hooks.failRestoreRead && restoreWrites.length > 0 && reads.length === 1)
    )
      return route.abort();
    return route.fulfill({
      json: { ok: true, document: state.document, revision: state.revision },
    });
  });
  let renderedDocument: StudioDocument | undefined;
  let jobReads = 0;
  await page.route(`${origin}/__sync-studio/job`, (route) => {
    jobReads++;
    return route.fulfill({
      json:
        hooks.failFirstJobRead && jobReads === 1
          ? {
              ok: false,
              status: "failed",
              error:
                "De geverifieerde uitvoer kan tijdelijk niet worden gelezen.",
            }
          : { ok: true, status: "ready", document: renderedDocument },
    });
  });
  await page.route(`${origin}/__sync-studio/render`, (route) => {
    const input = route.request().postDataJSON();
    renderWrites.push(input);
    let receipt = receipts.get(input.idempotencyKey);
    if (!receipt) {
      renderedDocument = structuredClone(state.document);
      receipt = {
        ok: true,
        outcome: "queued",
        jobId: "22600000-0000-4000-8000-000000000090",
      };
      receipts.set(input.idempotencyKey, receipt);
    }
    if (hooks.dropFirstRender && renderWrites.length === 1)
      return route.abort();
    return route.fulfill({ json: receipt });
  });
  await page.route(`${origin}/__sync-studio/copy`, (route) => {
    const input = route.request().postDataJSON();
    copyWrites.push(input);
    let receipt = receipts.get(input.idempotencyKey);
    if (!receipt) {
      receipt = {
        ok: true,
        outcome: "created",
        projectId: "22600000-0000-4000-8000-000000000091",
      };
      receipts.set(input.idempotencyKey, receipt);
    }
    if (hooks.dropFirstCopy && copyWrites.length === 1) return route.abort();
    return route.fulfill({ json: receipt });
  });
  await page.route(`${origin}/__sync-studio/restore`, (route) => {
    const input = route.request().postDataJSON();
    restoreWrites.push(input);
    let receipt = receipts.get(input.idempotencyKey);
    if (!receipt) {
      state.document = structuredClone(snapshot);
      state.revision++;
      receipt = { ok: true, outcome: "restored", revision: state.revision };
      receipts.set(input.idempotencyKey, receipt);
    }
    if (hooks.dropFirstRestore && restoreWrites.length === 1)
      return route.abort();
    return route.fulfill({ json: receipt });
  });
  await page.route(`${origin}/__sync-studio/series`,route=>{
    const input=route.request().postDataJSON() as SyncStudioSeriesCommand;seriesWrites.push(input);
    if(hooks.rejectSeriesRecovery&&seriesWrites.length>1)return route.fulfill({json:{ok:false,rejected:true,error:'De huidige toegang wijst deze poging af; een eerdere opdracht kan al bevestigd zijn.'}});
    let receipt=receipts.get(input.idempotencyKey);
    if(!receipt){
      if(!state.series)state.series={id:'22600000-0000-4000-8000-000000000095',name:input.name||'Wedstrijddag',revision:0,items:[{id:input.projectId,name:state.document.syncPresentation!.name,order:0,draftRevision:state.revision,document:structuredClone(state.document)}]};
      const current=state.series.items.find(item=>item.id===input.projectId)!;let next=input.projectId;
      if(input.operation==='add'||input.operation==='duplicate'){
        next='22600000-0000-4000-8000-'+String(100+state.series.items.length).padStart(12,'0');const clone={...current,id:next,name:current.name+' · kopie',document:structuredClone(state.document),draftRevision:0};
        if(input.operation==='duplicate')state.series.items.splice(state.series.items.indexOf(current)+1,0,clone);else state.series.items.push(clone);
      }else if(input.operation==='reorder')state.series.items=input.memberIds!.map(id=>state.series!.items.find(item=>item.id===id)!);
      else if(input.operation==='remove'){state.series.items=state.series.items.filter(item=>item.id!==input.projectId);next=state.series.items[0]!.id;}
      else if(input.operation==='rename')state.series.name=input.name!;
      state.series.items.forEach((item,index)=>{item.order=index;});state.series.revision++;
      receipt={ok:true,seriesId:state.series.id,revision:state.series.revision,projectIds:state.series.items.map(item=>item.id),nextProjectId:next};receipts.set(input.idempotencyKey,receipt);
    }
    if(hooks.dropFirstSeries&&seriesWrites.length===1)return route.abort();
    return route.fulfill({json:receipt});
  });
  await page.route(`${origin}/__sync-studio/fixture`, (route) => {
    const permissions = {
      canArchive: true,
      canCreate: !hooks.viewer,
      canEdit: !hooks.viewer,
      canManageBrand: !hooks.viewer,
      canManageJobs: !hooks.viewer,
      canManageTemplate: !hooks.viewer,
      canRender: !hooks.viewer,
      canUploadMedia: !hooks.viewer,
    };
    const props = {
      project: {
        id: "22600000-0000-4000-8000-000000000080",
        document: state.document,
        draftRevision: state.revision,
        projectRevision: 1,
        name: "Programma",
        kind: "design",
        status: "active",
        orientation: state.document.artboard.orientation,
        motionEnabled: state.document.motion.enabled,
        durationMs: state.document.motion.durationMs,
        createdAt: "2026-10-18T01:00:00Z",
        updatedAt: "2026-10-18T01:00:00Z",
        ownerUserId: "22600000-0000-4000-8000-000000000081",
        lastExportMediaId: null,
        lastRenderStatus: null,
      },
      assets: [],
      series:state.series,
      permissions,
      tenantId: "22600000-0000-4000-8000-000000000082",
      isLive: true,
      renderJobs: [],
      revisions: [
        {
          id: "22600000-0000-4000-8000-000000000092",
          number: 1,
          document: snapshot,
          createdAt: "2026-10-18T01:00:00Z",
          reason: "render",
        },
      ],
    };
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><title>Studio · VeyoCast testfixture</title><style>${styles}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify(props).replace(/</g, "\\u003c")};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    });
  });
  await page.goto(`${origin}/__sync-studio/fixture`);
  await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toBeVisible();
  return {
    state,
    writes,
    reads,
    renderWrites,
    copyWrites,
    restoreWrites,
    seriesWrites,
    errors,
  };
}


for (const width of [390, 1440]) test(`actual scene selection, orientation pairing and saved reload at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await galleryRoutes(page, origin);
  const run = await mount(page);
  for (const scene of syncBackgroundScenes) {
    await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
    const picker = page.getByRole("group", { name: "Achtergrond", exact: true });
    await expect(picker.getByRole("button")).toHaveCount(8);
    const choice = picker.getByRole("button", { name: scene.label, exact: true }); await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".vc-slide-preview").first()).toHaveCSS("background-image", new RegExp(scene.landscape.path.replaceAll(".", "\\.")));
    await page.getByRole("button", { name: "Staand formaat", exact: true }).click();
    await expect(page.locator(".vc-slide-preview").first()).toHaveCSS("background-image", new RegExp(scene.portrait.path.replaceAll(".", "\\.")));
    await page.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => run.writes.length).toBe(syncBackgroundScenes.indexOf(scene) + 1);
    const sent = run.writes.at(-1)!;
    const command = sent as unknown as { document?: StudioDocument; request?: SyncDynamicRequest };
    const presentation = command.document?.syncPresentation ?? (command.request?.configuration.syncConfiguration as SyncDynamicConfiguration).seed;
    expect(presentation).toMatchObject({ orientation: "portrait", style: { background: "photo", backgroundAsset: { kind: "system", path: scene.portrait.path, checksumSha256: scene.portrait.sha256 } } });
    await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toBeEnabled();
    await page.reload(); await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
    await expect(page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: scene.label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Liggend formaat", exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: "Houtrust", exact: true }).focus();
  await page.keyboard.press("Enter");
  expect((await new AxeBuilder({ page }).include("#control-content").analyze()).violations).toEqual([]);
  await info.attach("saved-background-picker", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(run.errors).toEqual([]);
});
test("a lost save replays the exact chosen scene and nonce after reload", async ({ page }) => {
  await galleryRoutes(page, origin); const run = await mount(page, { dropFirstSave: true });
  const scene = syncBackgroundScenes[1];
  await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
  await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: scene.label, exact: true }).click();
  await page.getByRole("button", { name: "Staand formaat", exact: true }).click(); await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("De opslag is niet bevestigd.");
  const original = JSON.stringify(run.writes[0]); await page.reload();
  await page.getByRole("button", { name: "Dezelfde wijziging bevestigen", exact: true }).click();
  await expect.poll(() => run.writes.length).toBe(2); expect(JSON.stringify(run.writes[1])).toBe(original);
  expect(original).toContain(scene.portrait.sha256); expect(original).not.toContain(origin); expect(run.errors).toEqual([]);
});

});

test.describe("saved connected background picker", () => {
const origin='http://127.0.0.1:3315',id='22600000-0000-4000-8000-000000000151',sourceId='22600000-0000-4000-8000-000000000152';
const require=createRequire(join(process.cwd(),'package.json')),compiler=require.resolve('esbuild',{paths:[require.resolve('tsx')]});
let bundle:{js:string;css:string};
test.beforeAll(()=>{
 const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{SyncDynamicEditor}from'./apps/control/app/(shell)/dashboard/slides/sync-dynamic-editor';function App(){const[portal,setPortal]=useState(null);return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main className="main-content" id="control-content"><SyncDynamicEditor {...globalThis.fixtureProps}/></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
 const code=`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-source-transport',setup(b){b.onResolve({filter:/sync-dynamic-actions$/},a=>({path:a.path,namespace:'commands'}));b.onLoad({filter:/.*/,namespace:'commands'},()=>({contents:'async function post(path,input){const reply=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(!reply.ok)throw Error("Transport unavailable");return reply.json()}export const mutateSyncDynamicAuthoringAction=input=>post("/__source/write",input);export const previewSyncDynamicAuthoringAction=input=>post("/__source/preview",input);export const loadSyncDynamicBindingOptionsAction=input=>post("/__source/options",input);',loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{replace:path=>window.location.replace(path)}}',loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));}}]});const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text;const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Fixture build omitted JavaScript or CSS');process.stdout.write(JSON.stringify({js,css}));`;
 bundle=JSON.parse(execFileSync(process.execPath,['-e',`(async()=>{${code}})().catch(e=>{console.error(e.message);process.exitCode=1})`],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024}));
});
async function mount(page:Page,hooks:{dropSave?:boolean;dropPublish?:boolean;conflict?:boolean;reject?:boolean;failPreview?:boolean;create?:boolean;dropCreate?:boolean;sportFamily?:SyncContentFamily;optionsFail?:boolean}={}){
 const seed=createSyncStudioStarter({family:hooks.sportFamily??'menu',tenantName:'Eigen club'}).syncPresentation!;
 const cfg:SyncDynamicConfiguration={schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:syncConnectedAuthoringType(seed.family)!,secondsPerPage:3,seed:{...seed,name:'Eigen bronontwerp',rows:[],news:[],ownRowIndexes:[],state:'ready'}};
 const state={revision:hooks.create?0:4,request:{templateVersionId:id,dataSourceId:hooks.create?'':sourceId,configuration:{maxItems:200,syncConfiguration:cfg}}as SyncDynamicRequest};
 const writes:SyncDynamicCommand[]=[],previews:SyncDynamicRequest[]=[],receipts=new Map<string,unknown>(),errors:string[]=[];let jobs=0;
 page.on('pageerror',error=>errors.push(error.message));
 const css=['tokens/veyocast-design-tokens.css','packages/ui/src/styles.css','apps/control/app/globals.css','apps/control/app/fieldflow.css','apps/control/app/sync-source.css','apps/control/app/sync-adapter.css'].map(path=>readFileSync(path,'utf8').replace(/@import[^;]+;/g,'')).join('\n');
 await page.route(origin+'/assets/*',route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1)!;if(!/^[a-zA-Z0-9_.-]+$/.test(name))return route.abort();return route.fulfill({body:readFileSync(join(process.cwd(),'apps/control/public/assets',name)),contentType:name.endsWith('.woff2')?'font/woff2':name.endsWith('.ttf')?'font/ttf':'image/webp'});});
 await page.route(origin+'/__source/options',route=>{const input=route.request().postDataJSON()as {sourceId:string};return route.fulfill({json:hooks.optionsFail?{ok:false,error:'De teams en bronrechten konden niet worden bevestigd. Je ontwerp blijft behouden; controleer de bron.'}:{ok:true,options:{sourceId:input.sourceId,teams:[{externalId:'team-a',name:'Eigen team A',contexts:[{label:'Eigen competitie · poule A · periode 2',competitionId:'competition-a',phaseId:'2',poolId:'pool-a',seasonId:'2026-2027'}]}],capabilities:[{article:'club-matches',capability:'matches',available:true,enabled:true}],privacyPeople:true,privacyBirthdays:true}}});});
 await page.route(origin+'/__source/preview',route=>{
  const input=route.request().postDataJSON()as SyncDynamicRequest;previews.push(input);
  if(hooks.failPreview)return route.fulfill({json:{ok:false,error:'De bron is nu onbereikbaar. Je ontwerp blijft behouden; probeer opnieuw.'}});
  const cfg=input.configuration.syncConfiguration as SyncDynamicConfiguration;
  return route.fulfill({json:{ok:true,presentation:{...cfg.seed,rows:Array.from({length:9},(_,i)=>[`Eigen product ${i+1}`,`€ ${i+2},50`,'','']),news:[],state:'ready'},assets:{},source:{providerStatus:'healthy',lastSuccessfulSyncAt:'2026-10-18T06:00:00Z',lastErrorCode:null}}});
 });
 await page.route(origin+'/__source/write',async route=>{
  const input=route.request().postDataJSON()as SyncDynamicCommand;writes.push(input);
  if(hooks.reject)return route.fulfill({json:{ok:false,rejected:true,error:'Deze bronselectie is geweigerd. Je invoer blijft behouden; controleer de bron.'}});
  if(hooks.conflict)return route.fulfill({json:{ok:false,rejected:true,conflict:true,error:'Het concept is gewijzigd. Je invoer blijft behouden; lees de actuele versie.'}});
  let receipt=receipts.get(input.idempotencyKey);
  if(!receipt){if(input.action==='save'){state.request=input.request as SyncDynamicRequest;state.revision++;receipt={ok:true,slideId:id,editRevision:state.revision};}else{jobs++;receipt={ok:true,slideId:id};}receipts.set(input.idempotencyKey,receipt);if(input.action==='save'&&hooks.dropSave||input.action==='publish'&&hooks.dropPublish||input.action==='create'&&hooks.dropCreate)return route.abort();}
  return route.fulfill({json:receipt});
 });
 await page.route(origin+'/fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><title>Gekoppeld Source-ontwerp</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify({tenantId:id,slideId:hooks.create?null:id,versionId:hooks.create?null:id,createKey:hooks.create?'owned-menu':undefined,initialRevision:state.revision,initialRequest:state.request,sources:[{id:sourceId,name:'Eigen catalogus',kind:hooks.sportFamily?'sportlink':'manual_products',provider_status:'healthy',last_successful_sync_at:'2026-10-18T06:00:00Z',last_error_code:null}],templates:[{current_published_version_id:id,orientation:'landscape',slug:'actual-template'},{current_published_version_id:'22600000-0000-4000-8000-000000000153',orientation:'portrait',slug:'actual-template-portrait'}],assets:[],error:null}).replace(/</g,'\\u003c')};${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto(origin+'/fixture');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeEnabled();if(!hooks.create)await expect.poll(()=>previews.length).toBeGreaterThan(0);
 return{state,writes,previews,receipts,errors,jobs:()=>jobs};
}

for (const width of [390, 1440]) test(`actual scene selection, orientation pairing and saved reload at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await galleryRoutes(page, origin);
  const run = await mount(page);
  for (const scene of syncBackgroundScenes) {
    await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
    const picker = page.getByRole("group", { name: "Achtergrond", exact: true });
    await expect(picker.getByRole("button")).toHaveCount(8);
    const choice = picker.getByRole("button", { name: scene.label, exact: true }); await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".vc-slide-preview").first()).toHaveCSS("background-image", new RegExp(scene.landscape.path.replaceAll(".", "\\.")));
    await page.getByRole("button", { name: "Staand formaat", exact: true }).click();
    await expect(page.locator(".vc-slide-preview").first()).toHaveCSS("background-image", new RegExp(scene.portrait.path.replaceAll(".", "\\.")));
    await page.getByRole("button", { name: "Opslaan", exact: true }).click();
    await expect.poll(() => run.writes.length).toBe(syncBackgroundScenes.indexOf(scene) + 1);
    const sent = run.writes.at(-1)!;
    const command = sent as unknown as { document?: StudioDocument; request?: SyncDynamicRequest };
    const presentation = command.document?.syncPresentation ?? (command.request?.configuration.syncConfiguration as SyncDynamicConfiguration).seed;
    expect(presentation).toMatchObject({ orientation: "portrait", style: { background: "photo", backgroundAsset: { kind: "system", path: scene.portrait.path, checksumSha256: scene.portrait.sha256 } } });
    await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toBeEnabled();
    await page.reload(); await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
    await expect(page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: scene.label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Liggend formaat", exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: "Houtrust", exact: true }).focus();
  await page.keyboard.press("Enter");
  expect((await new AxeBuilder({ page }).include("#control-content").analyze()).violations).toEqual([]);
  await info.attach("saved-background-picker", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(run.errors).toEqual([]);
});
test("a lost save replays the exact chosen scene and nonce after reload", async ({ page }) => {
  await galleryRoutes(page, origin); const run = await mount(page, { dropSave: true });
  const scene = syncBackgroundScenes[1];
  await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
  await page.getByRole("group", { name: "Achtergrond", exact: true }).getByRole("button", { name: scene.label, exact: true }).click();
  await page.getByRole("button", { name: "Staand formaat", exact: true }).click(); await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("antwoord is verloren");
  const original = JSON.stringify(run.writes[0]); await page.reload();
  await page.getByRole("button", { name: "Dezelfde opdracht bevestigen", exact: true }).click();
  await expect.poll(() => run.writes.length).toBe(2); expect(JSON.stringify(run.writes[1])).toBe(original);
  expect(original).toContain(scene.portrait.sha256); expect(original).not.toContain(origin); expect(run.errors).toEqual([]);
});

});
