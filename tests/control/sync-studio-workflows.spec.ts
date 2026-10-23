import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createSyncStudioStarter,createSyncStudioDocument } from "../../packages/studio/src/sync";
import {syncOnzeTrotsSystemAssets,syncOnzeTrotsV9SystemAssets} from '@veyocast/contracts';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import type { StudioDocument } from "../../packages/studio/src/schema";
import type {StudioSeriesDetail} from '../../apps/control/app/(shell)/dashboard/studio/types';
import type {SyncStudioSeriesCommand} from '../../apps/control/app/(shell)/dashboard/studio/sync-studio-series-command';

// Actual Source controller/frame and styles. Controlled transport exercises
// receipts and form recovery; separate pgTAP and worker proofs use real services.
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
  approved?:boolean;
  approvedV9?:boolean;
  approvedPages?:boolean;
  approvedManualFamily?:'birthdays'|'activities'|'agenda';
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
  const approved=hooks.approvedManualFamily?createSyncStudioStarter({family:hooks.approvedManualFamily,tenantName:'Eigen club',theme:'onzetrots-tv'}).syncPresentation:hooks.approved||hooks.approvedV9?createSyncTemplatePreview(hooks.approvedPages?'birthdays':'standings',hooks.approvedV9?'sync-onzetrots-v9':'sync-onzetrots-v1'):undefined;
  if(approved?.rendererVersion==='sync-onzetrots-v1'&&hooks.approvedPages)approved.rich!.birthdays!.push({...approved.rich!.birthdays![0]!,id:'approved-seventh-birthday'});
  const document = approved?createSyncStudioDocument(approved,hooks.approvedPages?3:12):createSyncStudioStarter({
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
  await page.route(`${origin}/onzetrots-approved-v*/**`,route=>{
    const path=new URL(route.request().url()).pathname,asset=[...syncOnzeTrotsSystemAssets,...syncOnzeTrotsV9SystemAssets].find(asset=>asset.path===path);
    if(!asset)return route.abort();const bytes=readFileSync(join(process.cwd(),'apps/control/public',path));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);return route.fulfill({body:bytes,contentType:asset.mimeType});
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

test("Source title, internal name and orientation save through the existing command", async ({
  page,
}) => {
  const fixture = await mount(page);
  await page
    .getByLabel("Ontwerpnaam", { exact: true })
    .fill("Ons staande programma");
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Onze zaterdag");
  await page
    .getByRole("button", { name: "Staand formaat", exact: true })
    .click();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Versie 2 is veilig opgeslagen.", { exact: true }),
  ).toBeVisible();
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0]!.document.syncPresentation).toMatchObject({
    rendererVersion: "sync-v1",
    name: "Ons staande programma",
    title: "Onze zaterdag",
    orientation: "portrait",
  });
  expect(fixture.writes[0]!.document.artboard).toMatchObject({
    width: 1080,
    height: 1920,
  });
  expect(fixture.writes[0]!.document.sitesPresentation).toBeUndefined();
  await page.reload();
  await expect(
    page.getByText("Versie 2 · opgeslagen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Je lokale invoer is hersteld. Bewaar je wijzigingen wanneer je klaar bent.",
      { exact: true },
    ),
  ).toHaveCount(0);
  expect(fixture.errors).toEqual([]);
});

test("lost save receipt survives reload and cannot overwrite a newer canonical edit", async ({
  page,
}) => {
  const fixture = await mount(page, { dropFirstSave: true });
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Mijn bewaarde tekst");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dezelfde wijziging bevestigen" }),
  ).toBeVisible();
  expect(fixture.state.revision).toBe(2);
  const original = structuredClone(fixture.writes[0]!);
  fixture.state.document = {
    ...fixture.state.document,
    syncPresentation: {
      ...fixture.state.document.syncPresentation!,
      title: "Later bewaard door een ander",
    },
  };
  fixture.state.revision = 3;
  await page.reload();
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Mijn bewaarde tekst");
  await page
    .getByRole("button", { name: "Dezelfde wijziging bevestigen" })
    .click();
  await expect(
    page.getByRole("button", { name: "Huidige versie laden" }),
  ).toBeVisible();
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.writes[1]).toEqual(original);
  expect(fixture.state.revision).toBe(3);
  expect(fixture.state.document.syncPresentation!.title).toBe(
    "Later bewaard door een ander",
  );
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Mijn bewaarde tekst");
  expect(fixture.errors).toEqual([]);
});

test("confirmed save and failed current read remain separate outcomes", async ({
  page,
}) => {
  const fixture = await mount(page, { failFirstRead: true });
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Bevestigd ontwerp");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Huidige versie controleren" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dezelfde wijziging bevestigen" }),
  ).toHaveCount(0);
  expect(fixture.writes).toHaveLength(1);
  await page
    .getByRole("button", { name: "Huidige versie controleren" })
    .click();
  await expect(
    page.getByText("Versie 2 is bevestigd.", { exact: true }),
  ).toBeVisible();
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test("incomplete row text remains editable after reload without being marked saved", async ({
  page,
}) => {
  const fixture = await mount(page);
  await page.getByRole("button", { name: "Gegevensbron", exact: true }).click();
  const raw = "Thuis | Uit | 11:00 | 2 | nog niet af";
  await page.getByLabel("Rijen · één rij per regel", { exact: true }).fill(raw);
  await expect(
    page.getByRole("button", { name: "Opslaan", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Gegevensbron", exact: true }).click();
  await expect(
    page.getByLabel("Rijen · één rij per regel", { exact: true }),
  ).toHaveValue(raw);
  await expect(
    page.getByText("Niet opgeslagen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Opslaan", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Rijen · één rij per regel", { exact: true })
    .fill("Thuis | Uit | 11:00 | 2");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Versie 2 is veilig opgeslagen.", { exact: true }),
  ).toBeVisible();
  expect(fixture.errors).toEqual([]);
});

test("an incomplete video URL survives reload and never reaches a writer", async ({
  page,
}) => {
  const fixture = await mount(page, { family: "youtube" });
  await page.getByLabel("YouTube-link", { exact: true }).fill("https://you");
  await page.reload();
  await expect(page.getByLabel("YouTube-link", { exact: true })).toHaveValue(
    "https://you",
  );
  await expect(
    page.getByRole("button", { name: "Opslaan", exact: true }),
  ).toBeDisabled();
  expect(fixture.writes).toHaveLength(0);
  expect(fixture.errors).toEqual([]);
});

test("read-only preview closes to its trigger without permitting edits", async ({
  page,
}) => {
  const fixture = await mount(page, { viewer: true });
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Opslaan", exact: true }),
  ).toBeDisabled();
  const trigger = page.getByRole("button", { name: "Voorbeeld", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(fixture.writes).toHaveLength(0);
  expect(fixture.errors).toEqual([]);
});

test("Source editor is accessible and has no horizontal overflow at five widths", async ({
  page,
}) => {
  const fixture = await mount(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  expect(fixture.errors).toEqual([]);
});

test("lost render acknowledgement survives reload and confirms the original output independently of newer edits", async ({
  page,
}) => {
  const fixture = await mount(page, { dropFirstRender: true });
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page
    .getByRole("button", { name: "Schermvoorbeeld maken", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Uitvoeropdracht bevestigen",
      exact: true,
    }),
  ).toBeVisible();
  const original = structuredClone(fixture.renderWrites[0]);
  fixture.state.document = {
    ...fixture.state.document,
    syncPresentation: {
      ...fixture.state.document.syncPresentation!,
      title: "Nieuwe canonieke inhoud",
    },
  };
  fixture.state.revision = 2;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Huidige versie laden", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page
    .getByRole("button", { name: "Uitvoeropdracht bevestigen", exact: true })
    .click();
  await expect(
    page.getByText(
      "De geverifieerde uitvoer van dit ontwerp staat in de bibliotheek.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(fixture.renderWrites).toEqual([original, original]);
  expect(fixture.writes).toHaveLength(0);
  expect(fixture.state.revision).toBe(2);
  await page.getByRole("button", { name: "Inhoud", exact: true }).click();
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Mijn nog nieuwere invoer");
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await expect(
    page.getByText(
      "De geverifieerde uitvoer hoort bij een eerdere versie. Maak na het opslaan een nieuw schermvoorbeeld voor je huidige invoer.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(fixture.errors).toEqual([]);
});

test("confirming an older copy after reload preserves newer local input", async ({
  page,
}) => {
  const fixture = await mount(page, { dropFirstCopy: true });
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Inhoud voor de kopie");
  fixture.state.revision = 2;
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await page
    .getByRole("button", { name: "Mijn invoer als kopie bewaren", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Dezelfde kopie bevestigen",
      exact: true,
    }),
  ).toBeVisible();
  const original = structuredClone(fixture.copyWrites[0]);
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Nieuwere invoer behouden");
  await page.reload();
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Nieuwere invoer behouden");
  await page
    .getByRole("button", { name: "Dezelfde kopie bevestigen", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Bevestigde kopie openen", exact: true }),
  ).toBeVisible();
  expect(fixture.copyWrites).toEqual([original, original]);
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Nieuwere invoer behouden");
  expect(
    await page.evaluate(() => Reflect.get(globalThis, "visited") ?? []),
  ).toEqual([]);
  expect(fixture.errors).toEqual([]);
});

test("lost restore acknowledgement survives reload and cannot become a different restore", async ({
  page,
}) => {
  const fixture = await mount(page, { dropFirstRestore: true });
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page.getByRole("button", { name: /^Versiegeschiedenis/ }).click();
  await page
    .getByRole("button", { name: "Versie 1 herstellen", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Versiegeschiedenis", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Dezelfde versie herstellen",
      exact: true,
    }),
  ).toBeVisible();
  const original = structuredClone(fixture.restoreWrites[0]);
  await page.reload();
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Dezelfde versie herstellen", exact: true })
    .click();
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Historische inhoud");
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toBeEnabled();
  expect(fixture.restoreWrites).toEqual([original, original]);
  expect(fixture.state.revision).toBe(2);
  expect(fixture.errors).toEqual([]);
});

test("confirmed restore with failed read is recovered by readback after reload without a second write", async ({
  page,
}) => {
  const fixture = await mount(page, { failRestoreRead: true });
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page.getByRole("button", { name: /^Versiegeschiedenis/ }).click();
  await page
    .getByRole("button", { name: "Versie 1 herstellen", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Huidige versie controleren",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Dezelfde versie herstellen",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Huidige versie controleren", exact: true })
    .click();
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toHaveValue("Historische inhoud");
  expect(fixture.restoreWrites).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test("a first atomic rejection leaves the form editable and preserves input", async ({
  page,
}) => {
  const fixture = await mount(page, { rejectFirstSave: true });
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Afgewezen invoer behouden");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("deze poging afgewezen");
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Dezelfde wijziging bevestigen",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(fixture.state.revision).toBe(1);
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Herstelde invoer");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Versie 2 is veilig opgeslagen.", { exact: true }),
  ).toBeVisible();
  expect(fixture.writes[1]!.idempotencyKey).not.toBe(
    fixture.writes[0]!.idempotencyKey,
  );
  expect(fixture.errors).toEqual([]);
});

test("a later rejected replay cannot erase an earlier unknown committed command", async ({
  page,
}) => {
  const fixture = await mount(page, {
    dropFirstSave: true,
    rejectRecoverySave: true,
  });
  await page
    .getByLabel("Titel op het scherm", { exact: true })
    .fill("Oorspronkelijke onzekere wijziging");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await page
    .getByRole("button", { name: "Dezelfde wijziging bevestigen", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("deze poging afgewezen");
  await expect(
    page.getByLabel("Titel op het scherm", { exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Dezelfde wijziging bevestigen",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dezelfde wijziging bevestigen", exact: true })
    .click();
  expect(fixture.writes).toHaveLength(3);
  expect(fixture.writes[1]).toEqual(fixture.writes[0]);
  expect(fixture.writes[2]).toEqual(fixture.writes[0]);
  expect(fixture.state.revision).toBe(2);
  expect(fixture.errors).toEqual([]);
});

test("a failed output read does not turn a confirmed render job into a failed render", async ({
  page,
}) => {
  const fixture = await mount(page, { failFirstJobRead: true });
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page
    .getByRole("button", { name: "Schermvoorbeeld maken", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "tijdelijk niet worden gelezen",
  );
  await expect(
    page.getByText("De bevestigde opdracht wordt verwerkt.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "De geverifieerde uitvoer van dit ontwerp staat in de bibliotheek.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(fixture.renderWrites).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test("a verified private background is saved with the same asset identity", async ({page}) => {
  const fixture=await mount(page);
  const assetId='22600000-0000-4000-8000-000000000092',bytes=readFileSync('apps/control/public/assets/sync-icon-192.png'),checksum=createHash('sha256').update(bytes).digest('hex');
  let uploads=0;
  await page.route(origin+'/api/media/images',route=>{uploads++;expect(route.request().method()).toBe('POST');expect(route.request().postDataBuffer()?.includes(bytes)).toBe(true);return route.fulfill({json:{ok:true,data:{assetId}}});});
  await page.route(origin+'/api/publisher/library?*',route=>route.fulfill({json:{media:[{id:assetId,image:origin+'/uploaded-background.png',checksumSha256:checksum}]}}));
  await page.route(origin+'/uploaded-background.png',route=>route.fulfill({body:bytes,contentType:'image/png'}));
  await page.getByRole('button',{name:'Vormgeving',exact:true}).click();
  await page.getByLabel('Achtergrond uploaden',{exact:true}).setInputFiles({name:'Clubfoto.png',mimeType:'image/png',buffer:bytes});
  await expect(page.getByText('Je achtergrond is gecontroleerd en geselecteerd. Bewaar je ontwerp om de keuze vast te leggen.',{exact:true})).toBeVisible();
  expect(fixture.writes).toHaveLength(0);
  await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Opslaan',exact:true}).click();
  await expect(page.getByText('Versie 2 is veilig opgeslagen.',{exact:true})).toBeVisible();
  expect(fixture.state.document.syncPresentation?.style.backgroundAsset).toEqual({kind:'tenant',mediaAssetId:assetId,checksumSha256:checksum});
  await page.reload();expect(fixture.state.document.syncPresentation?.style.background).toBe('photo');
  expect(uploads).toBe(1);expect(fixture.errors).toEqual([]);
});

test('selected motion persists through save/reload, exports video, and can return to a still design',async({page})=>{
  const fixture=await mount(page);
  await page.getByRole('button',{name:'Instellingen',exact:true}).click();
  await page.getByLabel('Motion',{exact:true}).selectOption('dynamisch');
  await page.getByRole('button',{name:'Opslaan',exact:true}).click();
  await expect(page.getByText('Versie 2 is veilig opgeslagen.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Schermvoorbeeld maken',exact:true}).click();
  await expect.poll(()=>fixture.renderWrites.length).toBe(1);
  expect(fixture.renderWrites[0]).toMatchObject({outputKind:'mp4',expectedDraftRevision:2});
  await expect(page.getByText('De geverifieerde uitvoer van dit ontwerp staat in de bibliotheek.',{exact:true})).toBeVisible();
  await page.getByLabel('Motion',{exact:true}).selectOption('geen');
  await page.getByRole('button',{name:'Opslaan',exact:true}).click();
  await expect(page.getByText('Versie 3 is veilig opgeslagen.',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Instellingen',exact:true}).click();
  await expect(page.getByLabel('Motion',{exact:true})).toHaveValue('geen');
  expect(fixture.state.document.motion.enabled).toBe(false);
  expect(fixture.errors).toEqual([]);
});

test("an unconfirmed background upload preserves the design without an automatic retry", async ({page}) => {
  const fixture=await mount(page),bytes=readFileSync('apps/control/public/assets/sync-icon-192.png');let uploads=0;
  await page.route(origin+'/api/media/images',route=>{uploads++;return route.abort('failed');});
  await page.getByRole('button',{name:'Vormgeving',exact:true}).click();
  await page.getByLabel('Achtergrond uploaden',{exact:true}).setInputFiles({name:'Clubfoto.png',mimeType:'image/png',buffer:bytes});
  await expect(page.getByRole('alert')).toBeVisible();
  expect(fixture.state.document.syncPresentation?.style.background).toBe('stadium');expect(fixture.writes).toHaveLength(0);
  await page.reload();expect(uploads).toBe(1);expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

test('adding a Source series saves current input first and recovers a lost collection receipt after reload',async({page})=>{
 const fixture=await mount(page,{dropFirstSeries:true});await page.getByLabel('Titel op het scherm',{exact:true}).fill('Bewaar dit voor de nieuwe slide');await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Onderdeel van een reeks',{exact:true}).fill('Zondag · wedstrijddag');
 await page.getByRole('button',{name:'Slide aan deze reeks toevoegen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('reeksopdracht is niet bevestigd');expect(fixture.writes).toHaveLength(1);expect(fixture.seriesWrites).toHaveLength(1);expect(fixture.seriesWrites[0]).toMatchObject({draftRevision:2,seriesId:null,operation:'add',name:'Zondag · wedstrijddag'});expect(fixture.state.series!.items).toHaveLength(2);expect(fixture.state.series!.items[1]!.document.syncPresentation!.title).toBe('Bewaar dit voor de nieuwe slide');
 await page.reload();await expect(page.getByRole('button',{name:'Dezelfde reeksopdracht bevestigen',exact:true})).toBeVisible();await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'Dezelfde reeksopdracht bevestigen',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'visited')??[])).toHaveLength(1);
 expect(fixture.seriesWrites).toHaveLength(2);expect(fixture.seriesWrites[1]).toEqual(fixture.seriesWrites[0]);expect(fixture.state.series!.items).toHaveLength(2);expect(fixture.writes).toHaveLength(1);expect(fixture.renderWrites).toEqual([]);expect(fixture.errors).toEqual([]);
});
test('a later series rejection preserves the original unknown command for exact recovery',async({page})=>{
 const hooks={dropFirstSeries:true,rejectSeriesRecovery:true};const fixture=await mount(page,hooks);await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByRole('button',{name:'Slide aan deze reeks toevoegen',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await page.reload();await page.getByRole('button',{name:'Dezelfde reeksopdracht bevestigen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('eerdere opdracht');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeDisabled();
 hooks.rejectSeriesRecovery=false;await page.reload();await page.getByRole('button',{name:'Dezelfde reeksopdracht bevestigen',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'visited')??[])).toHaveLength(1);expect(fixture.seriesWrites).toHaveLength(3);expect(fixture.seriesWrites.every(command=>JSON.stringify(command)===JSON.stringify(fixture.seriesWrites[0]))).toBe(true);expect(fixture.state.series!.items).toHaveLength(2);
});
test('Source collection order, independent copy and removal use actual UI controls',async({page})=>{
 const fixture=await mount(page,{initialSeries:true});await page.getByRole('button',{name:'Instellingen',exact:true}).click();await expect(page.getByRole('button',{name:'Eerder in reeks',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Later in reeks',exact:true}).click();await expect(page.getByText('Je reekswijziging is bevestigd door de server.',{exact:true})).toBeVisible();expect(fixture.seriesWrites[0]).toMatchObject({operation:'reorder',seriesRevision:1,memberIds:['22600000-0000-4000-8000-000000000093','22600000-0000-4000-8000-000000000080']});await page.reload();await page.getByRole('button',{name:'Instellingen',exact:true}).click();await expect(page.getByRole('button',{name:'Eerder in reeks',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Slide kopiëren',exact:true}).click();await expect.poll(()=>fixture.seriesWrites.length).toBe(2);expect(fixture.state.series!.items).toHaveLength(3);expect(fixture.seriesWrites[1]).toMatchObject({operation:'duplicate',seriesRevision:2});await page.reload();await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByRole('button',{name:'Uit reeks verwijderen',exact:true}).click();await expect.poll(()=>fixture.seriesWrites.length).toBe(3);expect(fixture.seriesWrites[2]).toMatchObject({operation:'remove',seriesRevision:3});expect(fixture.state.series!.items).toHaveLength(2);expect(fixture.renderWrites).toEqual([]);
 const scan=await new AxeBuilder({page}).analyze();expect(scan.violations).toEqual([]);
});

test('Source collection controls fit five widths and viewers can navigate without issuing a write',async({page})=>{
 const fixture=await mount(page,{initialSeries:true,viewer:true});await page.getByRole('button',{name:'Instellingen',exact:true}).click();await expect(page.getByRole('button',{name:'Slide aan deze reeks toevoegen',exact:true})).toBeDisabled();
 for(const width of[320,390,768,1024,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
 await page.getByRole('button',{name:'Ontwerp openen: Tweede ontwerp',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,'visited')??[])).toEqual(['/dashboard/studio/22600000-0000-4000-8000-000000000093']);expect(fixture.seriesWrites).toEqual([]);expect(fixture.writes).toEqual([]);
});

test('an incomplete internal Source name survives reload without starting a writer',async({page})=>{
 const fixture=await mount(page);await page.getByLabel('Ontwerpnaam',{exact:true}).fill('');await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeDisabled();await page.reload();await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeDisabled();expect(fixture.writes).toEqual([]);await page.getByLabel('Ontwerpnaam',{exact:true}).fill('Een geldige eigen naam');await expect(page.getByRole('button',{name:'Opslaan',exact:true})).toBeEnabled();
});


test('Source Engage reads paginated owned choices and saves only an explicit campaign selection without preparing media',async({page})=>{
 const first='50000000-0000-4000-8000-000000000232',second='60000000-0000-4000-8000-000000000232',lookups:Array<{search:string;offset:number}>=[];
 await page.route(origin+'/__sync-studio/engage-choices',route=>{const input=route.request().postDataJSON();lookups.push(input);return route.fulfill({json:{ok:true,choices:input.offset?[{id:second,title:'Volgende eigen campagne',status:'scheduled'}]:[{id:first,title:'Eigen publieksvraag',status:'live'}],hasMore:input.offset===0}});});
 await page.route(origin+'/__sync-studio/engage-selection',route=>route.fulfill({json:{ok:true,secureQrAvailable:true,poll:{id:route.request().postDataJSON().publicId,title:'Wie was de beste speler?',status:'live',visibility:'after_vote',publicUrl:'https://control.example.invalid/engage/'+first,options:[{id:'20000000-0000-4000-8000-000000000232',label:'Eigen speler A',votes:0},{id:'30000000-0000-4000-8000-000000000232',label:'Eigen speler B',votes:0}]}}}));
 const fixture=await mount(page,{family:'engage'});await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();await expect(page.getByLabel('Gekoppelde publieksvraag',{exact:true}).locator('option[value="'+first+'"]')).toHaveCount(1);await page.getByRole('button',{name:'Meer campagnes',exact:true}).click();await expect(page.getByLabel('Gekoppelde publieksvraag',{exact:true}).locator('option[value="'+second+'"]')).toHaveCount(1);expect(lookups.map(v=>v.offset)).toEqual([0,1]);
 await page.getByLabel('Gekoppelde publieksvraag',{exact:true}).selectOption(first);await expect(page.locator('.vc-slide-preview').first()).toContainText('Wie was de beste speler?');await expect(page.locator('.vc-slide-preview').first().locator('.vc-engage-result strong')).toHaveCount(0);expect(fixture.writes).toEqual([]);expect(fixture.renderWrites).toEqual([]);
 for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(1);expect(fixture.state.document.syncPresentation?.poll).toMatchObject({id:first,visibility:'after_vote',options:[{votes:0},{votes:0}]});expect(fixture.renderWrites).toEqual([]);expect(fixture.errors).toEqual([]);
});

test('an unconfirmed Source campaign change retains the previous complete choice and sends no save or render',async({page})=>{
 const first='50000000-0000-4000-8000-000000000232',second='60000000-0000-4000-8000-000000000232';
 await page.route(origin+'/__sync-studio/engage-choices',route=>route.fulfill({json:{ok:true,choices:[{id:first,title:'Eigen publieksvraag',status:'live'},{id:second,title:'Niet bevestigde keuze',status:'live'}],hasMore:false}}));
 await page.route(origin+'/__sync-studio/engage-selection',route=>route.fulfill({json:route.request().postDataJSON().publicId===second?{ok:false,error:'De publieke status is niet bevestigd. Je vorige keuze blijft behouden; probeer opnieuw.'}:{ok:true,secureQrAvailable:true,poll:{id:first,title:'Eigen bevestigde vraag',status:'live',visibility:'after_vote',options:[{id:first,label:'Eigen keuze A',votes:0},{id:second,label:'Eigen keuze B',votes:0}]}}}));
 const fixture=await mount(page,{family:'engage'});await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();const choice=page.getByLabel('Gekoppelde publieksvraag',{exact:true});await expect(choice.locator('option[value="'+first+'"]')).toHaveCount(1);await choice.selectOption(first);await expect(page.locator('.vc-slide-preview').first()).toContainText('Eigen bevestigde vraag');await choice.selectOption(second);await expect(page.getByRole('alert')).toContainText('vorige keuze blijft behouden');await expect(choice).toHaveValue(first);await expect(page.locator('.vc-slide-preview').first()).toContainText('Eigen bevestigde vraag');expect(fixture.writes).toEqual([]);expect(fixture.renderWrites).toEqual([]);expect(fixture.errors).toEqual([]);
});

test('Source YouTube chooses an existing verified source without saving, rendering or changing the source',async({page})=>{
 const fixture=await mount(page,{family:'youtube'}),url='https://www.youtube.com/watch?v=abcdefghijk';
 let reads=0;
 await page.route(origin+'/__sync-studio/youtube-choices',route=>{reads++;return route.fulfill({json:{ok:true,choices:[{id:'22600000-0000-4000-8000-000000000121',title:'Eigen gecontroleerde videobron',url}],hasMore:false}});});
 await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();const choice=page.getByLabel('Gecontroleerde YouTube-bron',{exact:true});await expect(choice.locator('option').filter({hasText:'Eigen gecontroleerde videobron'})).toHaveCount(1);await choice.selectOption(url);await expect(page.getByLabel('Videobron zoeken',{exact:true})).toBeVisible();expect(fixture.writes).toHaveLength(0);expect(fixture.renderWrites).toHaveLength(0);
 await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.getByText('Versie 2 is veilig opgeslagen.',{exact:true})).toBeVisible();expect(fixture.state.document.syncPresentation?.youtubeUrl).toBe(url);expect(fixture.writes).toHaveLength(1);expect(fixture.renderWrites).toHaveLength(0);expect(reads).toBe(1);
 await page.reload();await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();await expect(page.getByLabel('Gecontroleerde YouTube-bron',{exact:true})).toHaveValue(url);const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}expect(fixture.errors).toEqual([]);
});


test("an existing OnzeTrots design can choose Clubmuur again and retain it after saving and reloading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await mount(page);
  await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
  await page.getByRole("button", { name: /OnzeTrots TV/ }).click();
  const assertAuthoringTouch = async () => {
    const alignment = page.getByRole("group", { name: "Uitlijning", exact: true });
    for (const name of ["Links", "Midden", "Rechts"]) {
      const control = alignment.getByRole("button", { name, exact: true });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toHaveCSS("font-size", "14px");
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const summary = page.locator(".vc-studio-properties details > summary").filter({ hasText: /^Clubbeelden en achtergrond$/ });
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toHaveCSS("display", "list-item");
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const box = await summary.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const details = summary.locator("..");
    await expect(details).not.toHaveAttribute("open", "");
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await expect(page.getByLabel("Uitsnede foto", { exact: true })).toBeVisible();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(details).not.toHaveAttribute("open", "");
  };
  await assertAuthoringTouch();
  const alignment = page.getByRole("group", { name: "Uitlijning", exact: true });
  await alignment.getByRole("button", { name: "Midden", exact: true }).click();
  await expect(alignment.getByRole("button", { name: "Midden", exact: true })).toHaveAttribute("aria-pressed", "true");
  await alignment.getByRole("button", { name: "Links", exact: true }).click();
  await expect(alignment.getByRole("button", { name: "Links", exact: true })).toHaveAttribute("aria-pressed", "true");
  const light = page.getByRole("button", { name: "Licht", exact: true });
  const wall = page.getByRole("button", { name: "Clubmuur", exact: true });
  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await wall.click();
  await expect(wall).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".vc-stage-canvas .vc-slide-preview").first()).toHaveClass(/bg-clubmuur/);
  expect(await page.locator(".vc-stage-canvas .vc-slide-preview").first().evaluate(element => getComputedStyle(element).backgroundImage)).toContain("/assets/clubmuur-wall.webp");
  expect(fixture.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByText("Versie 2 is veilig opgeslagen.", { exact: true })).toBeVisible();
  expect(fixture.state.document.syncPresentation?.style.background).toBe("clubmuur");
  expect(fixture.state.document.syncPresentation?.style.backgroundAsset).toBeUndefined();
  await page.reload();
  await page.getByRole("button", { name: "Vormgeving", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clubmuur", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".vc-stage-canvas .vc-slide-preview").first()).toHaveClass(/bg-clubmuur/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthoringTouch();
  const axe = await new AxeBuilder({ page }).include(".vc-studio-properties").analyze();
  expect(axe.violations).toEqual([]);
  expect(fixture.renderWrites).toEqual([]);
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test('approved OnzeTrots editor uses full-cycle duration and pauses its one moving own row without a jump',async({page})=>{
 const fixture=await mount(page,{approved:true});
 const stage=page.locator('.vc-stage-canvas'),list=stage.locator('[data-ot-rank-list]');
 await expect(list).toBeVisible();await expect(stage.locator('.rank-row')).toHaveCount(14);
 await expect(page.locator('.vc-stage-caption')).toContainText('38s per pagina');
 await page.getByRole('button',{name:'Afspelen',exact:true}).click();
 await expect.poll(()=>list.evaluate(element=>element.scrollTop),{timeout:7000}).toBeGreaterThan(20);
 await page.getByRole('button',{name:'Pauzeren',exact:true}).click();const paused=await list.evaluate(element=>element.scrollTop);
 await page.waitForTimeout(300);expect(await list.evaluate(element=>element.scrollTop)).toBe(paused);expect(paused).toBeGreaterThan(20);
 await page.getByRole('button',{name:'Afspelen',exact:true}).click();await expect.poll(()=>list.evaluate(element=>element.scrollTop)).toBeGreaterThan(paused);
 await expect(stage.locator('.rank-row.own')).toHaveCount(1);expect(fixture.errors).toEqual([]);
});

test('approved editor keeps a manually selected continuation page across playback, pause and a hidden tab',async({page})=>{
 const fixture=await mount(page,{approved:true,approvedPages:true}),grid=page.locator('.vc-stage-canvas .fixed-six-grid');
 await expect(grid).toHaveAttribute('data-filled-count','6');
 await page.getByRole('button',{name:'Volgende pagina',exact:true}).click();await expect(grid).toHaveAttribute('data-filled-count','1');
 await page.getByRole('button',{name:'Afspelen',exact:true}).click();await page.waitForTimeout(150);await expect(grid).toHaveAttribute('data-filled-count','1');
 await page.getByRole('button',{name:'Pauzeren',exact:true}).click();await page.waitForTimeout(250);await expect(grid).toHaveAttribute('data-filled-count','1');
 await page.getByRole('button',{name:'Afspelen',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));await page.waitForTimeout(3200);
 await expect(grid).toHaveAttribute('data-filled-count','1');await expect(page.locator('.vc-page-controls > span')).toHaveText('2 / 2');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));await expect(grid).toHaveAttribute('data-filled-count','6',{timeout:5000});
 expect(fixture.writes).toEqual([]);expect(fixture.errors).toEqual([]);
});

for(const family of ['birthdays','activities','agenda']as const)test(`manual ${family} cards start empty and save only the entered facts through the real editor`,async({page})=>{
 const fixture=await mount(page,{approvedManualFamily:family}),stage=page.locator('.vc-stage-canvas');
 await expect(stage.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count','0');
 await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();
 await page.getByRole('button',{name:family==='birthdays'?'Jarige toevoegen':'Activiteit toevoegen',exact:true}).click();
 if(family==='birthdays'){
  await page.getByLabel('Naam · kaart 1',{exact:true}).fill('Eigen jarige');await page.getByLabel('Leeftijd · kaart 1',{exact:true}).fill('0');
  await page.getByLabel('Datum · kaart 1',{exact:true}).fill('24 oktober');await page.getByLabel('Team of toelichting · kaart 1',{exact:true}).fill('Eigen team');
  await expect(stage.locator('.birthday-name')).toContainText('Eigen J.');await expect(stage.locator('.birthday-age')).toHaveText('0');
 }else{
  await page.getByLabel('Activiteit · kaart 1',{exact:true}).fill('Eigen clubactiviteit');await page.getByLabel('Toelichting · kaart 1',{exact:true}).fill('Eigen beschrijving');
  await page.getByLabel('Datum · kaart 1',{exact:true}).fill('27 oktober');await page.getByLabel('Tijd · kaart 1',{exact:true}).fill('19:00');await page.getByLabel('Locatie · kaart 1',{exact:true}).fill('Eigen clubhuis');
  await expect(page.getByLabel('Afbeelding · kaart 1',{exact:true})).toHaveValue('');await expect(stage.locator('.event-card')).toContainText('Eigen clubactiviteit');
 }
 await expect(stage.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count','1');await expect(stage.locator('.empty-grid-slot')).toHaveCount(5);
 await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(1);
 const saved=fixture.writes[0]!.document.syncPresentation!;expect(saved.rendererVersion).toBe('sync-onzetrots-v9');
 if(saved.rendererVersion!=='sync-onzetrots-v9')throw Error('Wrong manual renderer');
 if(family==='birthdays')expect(saved.rich?.birthdays).toEqual([expect.objectContaining({displayName:'Eigen jarige',age:0,dateLabel:'24 oktober',meta:'Eigen team'})]);
 else expect(saved.rich?.activities).toEqual([expect.objectContaining({title:'Eigen clubactiviteit',body:'Eigen beschrijving',dateLabel:'27 oktober',timeLabel:'19:00',location:'Eigen clubhuis'})]);
 await page.reload();await expect(stage.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count','1');expect(fixture.errors).toEqual([]);
});

test('v9 replay starts the same scene from both studio and fullscreen, while reduced motion stays complete',async({page})=>{
 const fixture=await mount(page,{approvedV9:true});
 const stage=page.locator('.vc-stage-canvas');
 await expect(stage.locator('[data-ot-header-text]')).toBeVisible();
 const replay=page.getByRole('button',{name:'Opnieuw afspelen ↻',exact:true});
 await replay.click();
 await expect.poll(()=>stage.locator('.slide-header-container').evaluate(e=>Number(getComputedStyle(e).opacity))).toBe(0);
 await expect.poll(()=>stage.locator('.slide-header-container').evaluate(e=>Number(getComputedStyle(e).opacity)),{timeout:4000}).toBe(1);
 await page.getByRole('button',{name:'Pauzeren',exact:true}).click();
 await page.getByRole('button',{name:'Voorbeeld',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Opnieuw afspelen ↻',exact:true}).click();
 await expect.poll(()=>dialog.locator('.slide-header-container').evaluate(e=>Number(getComputedStyle(e).opacity))).toBe(0);
 await page.emulateMedia({reducedMotion:'reduce'});
 await dialog.getByRole('button',{name:'Opnieuw afspelen ↻',exact:true}).click();
 await expect(dialog.locator('.slide-header-container')).toHaveCSS('opacity','1');
 await expect(dialog.locator('.screen')).toHaveClass(/intro-finished/);
 expect(fixture.errors).toEqual([]);
});
