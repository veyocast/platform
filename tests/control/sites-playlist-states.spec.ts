import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Exercise the actual Source Editor and Picker. HTTP replies are deliberately
// controlled; authenticated publication and private byte verification have a
// separate live-database gate. No provider, demo production route or login stub.
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const url = `http://127.0.0.1:${process.env.CONTROL_PORT ?? 3103}/__sites-state/playlist`;
const output = process.env.SITES_PLAYLIST_STATE_EVIDENCE ?? "/dev/shm/veyocast-s191-playlist-state-evidence";
function csvRecords(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && character === ",") { row.push(cell); cell = ""; }
    else if (!quoted && character === "\n") { row.push(cell.replace(/\r$/u, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift()!;
  return rows.filter(values => values.length === headers.length).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]!])));
}
const cases = csvRecords(readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8"))
  .filter(row => row.case_kind === "PRODUCTION_STATE" && row.source_component?.includes("playlist-editor"));
if (cases.length !== 9) throw new Error("Original playlist production-state inventory changed.");
const entry = `
import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{PlaylistEditor}from'./apps/control/app/(shell)/dashboard/playlists/_components/sites/playlist-editor';
const id=n=>'19190000-0000-4000-8000-'+String(n).padStart(12,'0');
const state=new URLSearchParams(location.search).get('state');
const image='/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp';
const initial={id:id(1),name:'Clubhuis vandaag',description:'Bewaard eigen concept',status:'Concept',updated:'Vandaag',slides:state==='empty'?[]:[{id:id(2),mediaId:id(20),name:'Gereed clubbeeld',image,seconds:12,kind:'image'}]};
const assets=[{id:id(20),name:'Gereed clubbeeld',image,folder:'Clubfoto’s',size:'1 MB',kind:'image'}];
function App(){const[playlist,setPlaylist]=useState(initial),[media,setMedia]=useState(assets),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[closed,setClosed]=useState(false);const attempt=useRef(null);
window.__state={playlist,media,closed};
async function save(next){const fingerprint=JSON.stringify(next);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};const response=await fetch('/__sites-state/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playlist:next,idempotencyKey:attempt.current.key})});const result=await response.json();if(result.outcome==='conflict'){setNotice('Een andere sessie heeft serverversie 7 opgeslagen. Je eigen wijzigingen blijven open.');return null;}if(!response.ok)throw new Error('Storage transport failed');if(result.outcome!=='applied')return null;setPlaylist(result.playlist);return result.playlist;}
async function publish(next,screenIds){setBusy(true);try{await fetch('/__sites-state/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playlist:next,screenIds})});setNotice('De publicatie is aangevraagd. Het eerste Player-frame is nog niet bevestigd.');}finally{setBusy(false);}}
return <main><h1>Playlist statuscontrole</h1>{closed?<p>Editor gesloten</p>:<PlaylistEditor playlist={playlist}onChange={setPlaylist}onClose={()=>setClosed(true)}onSave={save}onPublish={(next,ids)=>void publish(next,ids)}inventory={[{id:id(40),name:'Clubhuis',group:'Binnen',orientation:'landscape',status:'unknown'}]}groups={[]}initialScreenIds={[]}media={media}onMediaChange={setMedia}designs={[]}projects={[]}onGoStudio={()=>{}}onAdvanced={()=>{}}busy={busy}notice={notice}canWrite={state!=='permission-readonly'}canPublish={state!=='permission-readonly'}renderPreview={slide=><img src={slide.image}alt={'Voorbeeld van '+slide.name}style={{width:'100%',height:'100%',objectFit:'contain'}}/>}/>}</main>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
let bundle: { js: string; css: string };
const evidence: Record<string, unknown>[] = [];
test.beforeAll(() => {
  const code = `const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),sourcefile:'playlist-states.tsx',loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'/tmp/playlist-states.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'unused-video',setup(build){build.onResolve({filter:/video-upload-form$/},args=>({path:args.path,namespace:'unused-video'}));build.onLoad({filter:/.*/,namespace:'unused-video'},()=>({contents:'export function VideoUploadForm(){return null}',loader:'js'}));build.onResolve({filter:/^\\//},()=>({external:true}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(error=>{console.error(error.message);process.exitCode=1;});`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});
test.afterAll(() => { mkdirSync(output, { recursive: true }); writeFileSync(join(output, "case-readback.json"), JSON.stringify({ schemaVersion: 1, sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", scope: "Actual production Editor/Picker, original mobile state IDs and controlled HTTP storage/processing/publication boundary. No inferred source pixel, database ACK or physical device result.", componentSha256: createHash("sha256").update(readFileSync("apps/control/app/(shell)/dashboard/playlists/_components/sites/playlist-editor.tsx")).digest("hex"), results: evidence }, null, 2)); });
for (const row of cases) {
  test(`original ${row.case_id} ${row.state}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const commands: unknown[] = []; let processingPolls = 0; let release: () => void = () => {};
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css"]
      .map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/gu, "")).join("\n");
    await page.route("**/__sites-state/playlist*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/giu, "<\\/script")}</script></body></html>` }));
    await page.route("**/fieldflow/**", route => { const path = new URL(route.request().url()).pathname; if (path.includes("..")) return route.abort(); return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", path)) }); });
    await page.route("**/api/publisher/library*", async route => {
      if (row.state === "loading") await barrier;
      const processing = row.state === "processing-media";
      if (processing && new URL(route.request().url()).searchParams.has("assetId")) processingPolls++;
      const data = await page.evaluate(() => Reflect.get(window, "__state") as { media: unknown[] });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ media: processing ? [] : data.media, projects: [], designs: [], folders: [], collections: [], total: processing ? 0 : data.media.length, hasMore: false }) });
    });
    await page.route("**/api/media/images", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: { assetId: "19190000-0000-4000-8000-000000000099" } }) }));
    await page.route("**/__sites-state/save", async route => {
      const request = route.request().postDataJSON(); commands.push(request);
      if (row.state === "publication-pending") await barrier;
      const failure = ["network-failure", "offline-stale"].includes(row.state!);
      return route.fulfill({ status: failure ? 503 : 200, contentType: "application/json", body: JSON.stringify(failure ? { outcome: "failed" } : row.state === "revision-conflict" ? { outcome: "conflict", actualRevision: 7 } : { outcome: "applied", playlist: request.playlist }) });
    });
    await page.route("**/__sites-state/publish", async route => { commands.push(route.request().postDataJSON()); await barrier; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ outcome: "pending" }) }); });
    await page.goto(`${url}?state=${encodeURIComponent(row.state!)}`);
    const editor = page.getByRole("dialog"); await expect(editor).toBeVisible();
    const details = async () => { await page.getByRole("button", { name: "Details", exact: true }).click(); return page.getByLabel("Naam playlist", { exact: true }); };
    const ownName = "Mijn bewaarde wijzigingen";
    switch (row.state) {
      case "loading": {
        const name = await details(); await name.fill(ownName);
        await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
        await expect(editor.locator('[aria-busy="true"]')).toBeVisible();
        await expect(page.getByRole("button", { name: "Gereed clubbeeld, selecteren", exact: true })).toBeVisible();
        release(); await page.getByRole("button", { name: "Terug naar playlist", exact: true }).click();
        await expect(await details()).toHaveValue(ownName); break;
      }
      case "empty":
        await expect(page.getByRole("button", { name: "Eerste inhoud toevoegen", exact: true })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Schermen kiezen en publiceren", exact: true })).toBeDisabled();
        await page.getByRole("button", { name: "Eerste inhoud toevoegen", exact: true }).click();
        await expect(page.getByRole("button", { name: "Gereed clubbeeld, selecteren", exact: true })).toBeVisible(); break;
      case "validation": {
        const name = await details(); await name.fill("X"); await expect(editor.getByRole("alert")).toContainText("minimaal twee tekens");
        await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled();
        await name.fill(ownName); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeEnabled(); break;
      }
      case "permission-readonly":
        await expect(await details()).toBeDisabled(); await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Toevoegen", exact: true })).toBeDisabled();
        await page.getByRole("button", { name: "Voorbeeld", exact: true }).click();
        await expect(page.getByRole("region", { name: "Playlistvoorbeeld" })).toBeVisible(); break;
      case "network-failure": case "revision-conflict": case "offline-stale": {
        const name = await details(); await name.fill(ownName);
        if (row.state === "offline-stale") await page.evaluate(() => window.dispatchEvent(new Event("veyocast-storage-error")));
        await page.getByRole("button", { name: "Opslaan", exact: true }).click();
        await expect(editor.getByRole("alert")).toContainText("wijzigingen blijven open"); await expect(name).toHaveValue(ownName);
        if (row.state === "revision-conflict") await expect(editor.getByText(/serverversie 7/)).toBeVisible();
        await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect.poll(() => commands.length).toBe(2);
        expect(commands[1]).toEqual(commands[0]);
        await page.keyboard.press("Escape"); await expect(page.getByRole("heading", { name: "Je hebt nog wijzigingen" })).toBeVisible();
        await page.getByRole("button", { name: "Verder bewerken", exact: true }).click(); await expect(name).toHaveValue(ownName); break;
      }
      case "processing-media": {
        await page.clock.install();
        // Keep the processing deadline independent of real HTTP/CPU latency;
        // advance the application clock explicitly after each observed poll.
        await page.clock.pauseAt(new Date(Date.now() + 60_000));
        await page.evaluate(() => {
          const schedule = window.setTimeout.bind(window);
          // Observe the real verification delay after its response is consumed.
          // Advancing at request arrival can otherwise race the asynchronous
          // response body and leave the next timer frozen at a later time.
          window.setTimeout = ((...args: Parameters<typeof window.setTimeout>) => {
            if (args[1] === 1000) Reflect.set(window, "__processingWaits", (Reflect.get(window, "__processingWaits") ?? 0) + 1);
            return schedule(...args);
          }) as typeof window.setTimeout;
        });
        await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
        await page.locator('input[type="file"]').setInputFiles({ name: "Nog niet geverifieerd.jpg", mimeType: "image/jpeg", buffer: readFileSync("apps/control/public/onzetrots/originals/clubhuis.jpg") });
        await expect(page.getByRole("progressbar", { name: "Voortgang upload" })).toBeVisible();
        for (let index = 0; index < 20; index++) {
          await expect.poll(() => processingPolls).toBeGreaterThanOrEqual(index + 1);
          await expect.poll(() => page.evaluate(() => Reflect.get(window, "__processingWaits"))).toBeGreaterThanOrEqual(index + 1);
          await page.clock.runFor(1100);
        }
        await expect(editor.getByText(/upload is opgeslagen en wordt nog verwerkt/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Nog niet geverifieerd, selecteren", exact: true })).toHaveCount(0);
        expect(commands).toHaveLength(0); break;
      }
      case "publication-pending": {
        const name = await details(); await name.fill(ownName);
        await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect(name).toBeDisabled();
        await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled();
        await expect(editor.getByText("De server controleert je wijzigingen…")).toBeVisible();
        release(); await expect(editor.getByText("Je concept is bevestigd door de server.")).toBeVisible();
        await editor.locator('button[aria-label="Schermen kiezen en publiceren"]').click();
        await page.getByRole("checkbox", { name: /Clubhuis/ }).check(); await page.getByRole("button", { name: "Publiceren", exact: true }).click();
        await expect(editor.getByText(/eerste Player-frame is nog niet bevestigd/)).toBeVisible(); break;
      }
      default: throw new Error(`Unimplemented original case ${row.case_id}`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.getBoundingClientRect().width > 0).map(image => image.decode())); });
    await expect(editor.getByText("Je concept is bevestigd door de server.", { exact: true })).toHaveCount(0);
    mkdirSync(output, { recursive: true }); const screenshot = join(output, `${row.case_id}.png`); await page.screenshot({ path: screenshot, fullPage: true });
    evidence.push({ caseId: row.case_id, status: "PASS", state: row.state, viewport: row.viewport, setup: row.setup, expected: row.assertions, actual: "Actual mobile component state, bounded recovery, retained concept, capability/busy controls and absence of false server/frame success verified.", commandCount: commands.length, screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex"), screenshot });
  });
}
