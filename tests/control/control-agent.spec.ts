import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { AgentAttachment, AgentProposal } from "../../apps/control/lib/agent/catalog";

const origin = "http://127.0.0.1:3317";
const require = createRequire(join(process.cwd(), "package.json"));
let bundle: { js: string; css: string };
const proposal: AgentProposal = { id: "31700000-0000-4000-8000-000000000001", conversation_id: "31700000-0000-4000-8000-000000000002", plan_hash: "a".repeat(64), status: "proposed", receipts: [], next_step: 0, last_error_code: null, plan: { schemaVersion: 1, timezone: "Europe/Amsterdam", steps: [{ domain: "playlist", operation: "move_item", commandKey: "31700000-0000-4000-8000-000000000003", label: "Clubavond", href: "/dashboard/playlists/clubavond", affectedScreens: [{ id: "screen-a", name: "Barscherm" }, { id: "screen-b", name: "Kantine" }], args: { id: "playlist-a", revision: 4, payload: { itemId: "same-media-second-occurrence", direction: "up" } } }] } };

test.beforeAll(() => {
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{AgentWorkspace}from'./apps/control/app/(shell)/dashboard/agent/workspace';createRoot(document.getElementById('root')).render(<AgentWorkspace tenantName="Testvereniging" timezone="Europe/Amsterdam" initialProposals={globalThis.initialProposals||[]} videoConfig={null}/>);`;
  const actions = ["decideAgentProposalAction", "openAgentConversationAction", "reviseAgentProposalAction", "sendAgentMessageAction", "readAgentAttachmentsAction", "readAgentPlayerStatusAction", "readAgentStudioPreviewAssetsAction", "generateAgentImageAction", "prepareImageSlideAction", "readAgentPlaylistPreviewAction", "cancelMediaVideoUpload", "finalizeMediaVideoUpload", "prepareMediaVideoUpload"];
  const commandModule = `async function post(name,args){const response=await fetch('/__agent/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});if(!response.ok)throw Error('Transport unavailable');return response.json();}${actions.map(name => `export const ${name}=(...args)=>post('${name}',args);`).join("")}`;
  const program = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'transport',setup(build){build.onResolve({filter:/actions$/},args=>({path:args.path,namespace:'commands'}));build.onLoad({filter:/.*/,namespace:'commands'},()=>({contents:${JSON.stringify(commandModule)},loader:'js'}));build.onResolve({filter:/^next\\/link$/},args=>({path:args.path,namespace:'link'}));build.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));build.onResolve({filter:/^next\\/navigation$/},args=>({path:args.path,namespace:'navigation'}));build.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export const useRouter=()=>({refresh(){},push(){}})',loader:'js'}));build.onResolve({filter:/^next\\/dynamic$/},args=>({path:args.path,namespace:'dynamic'}));build.onLoad({filter:/.*/,namespace:'dynamic'},()=>({contents:'export default function dynamic(){return ()=>null}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${program}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, initial: AgentProposal[] = [], mode: "normal" | "risk" | "offline" | "attachment-read-failure" = "normal") {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  let current = structuredClone(proposal);
  const attachments: AgentAttachment[] = [];
  let statusReads = 0;
  let attachmentReads = 0;
  const addImage = (id: string, title: string) => attachments.push({ id, title, status: "ready", kind: "image", width: 1024, height: 1536, previewUrl: `${origin}/__synthetic-image`, sourceUrl: `${origin}/__synthetic-image`, retained: false });
  await page.route(origin + "/__synthetic-image", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="white"/></svg>' }));
  await page.route(origin + "/api/agent/images", route => {
    const body = route.request().postData() ?? "";
    const name = /filename="([^"]+)"/.exec(body)?.[1] ?? "Afbeelding";
    addImage(`image-${attachments.length}`, name);
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, id: attachments.at(-1)!.id }) });
  });
  await page.route(origin + "/__agent/*", async route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const args = route.request().postDataJSON() as unknown[];
    calls.push({ name, args });
    const reply = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (name === "readAgentAttachmentsAction") { attachmentReads++; if (mode === "attachment-read-failure" && attachmentReads === 1) return route.abort(); return reply({ ok: true, attachments }); }
    if (name === "readAgentPlayerStatusAction") { statusReads++; return reply({ ok: true, status: { observedAt: "2026-11-18T12:00:00Z", screens: [{ id: "screen-a", name: "Barscherm", assigned_release_id: "new-release" }, { id: "screen-b", name: "Kantine", assigned_release_id: "new-release" }], devices: [{ id: "device-a", screen_id: "screen-a", active_release_id: statusReads > 1 ? "new-release" : "previous-release", last_seen_at: "2026-11-18T11:59:50Z" }, { id: "device-b", screen_id: "screen-b", active_release_id: "new-release", last_seen_at: "2026-11-18T11:59:50Z" }] } }); }
    if (name === "generateAgentImageAction") { addImage("generated-concept", (args[0] as { title: string }).title); await new Promise(resolve => setTimeout(resolve, 100)); return reply({ ok: true, id: "generated-concept" }); }
    if (name === "openAgentConversationAction") return reply({ ok: true, id: proposal.conversation_id });
    if (name === "sendAgentMessageAction") {
      if (mode === "offline") return route.abort();
      const messages = args[1] as Array<{ content: string }>;
      return reply(messages.at(-1)?.content === "Barscherm" ? { ok: true, reply: { text: "Controleer het exacte voorstel.", proposal: current } } : { ok: true, reply: { text: "Welk scherm bedoel je?", choices: ["Barscherm", "Kantine"] } });
    }
    if (name === "decideAgentProposalAction") {
      if (mode === "risk" && args[2] && args[3] !== "current-risk-hash") { current.status = "approved"; return reply({ ok: false, error: "Controleer de concrete waarschuwingen.", proposal: current, risk: { hash: "current-risk-hash", messages: ["Barscherm: heartbeat verouderd."] } }); }
      current = { ...current, status: args[2] ? "completed" : "cancelled", next_step: args[2] ? 1 : 0, receipts: args[2] ? [{ step: 0, result: { outcome: "applied", playlistId: "playlist-a" }, completedAt: "2026-11-18T12:00:00Z" }] : [] };
      await new Promise(resolve => setTimeout(resolve, 100));
      return reply({ ok: true, proposal: current });
    }
    if (name === "reviseAgentProposalAction") { current = { ...current, id: "revised", plan_hash: "b".repeat(64), plan: { ...current.plan, steps: args[1] as AgentProposal["plan"]["steps"] } }; return reply({ ok: true, proposal: current }); }
    return reply({ ok: false, error: "Geen testtransport ingesteld." });
  });
  await page.route(origin + "/__workspace", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><head><title>Control-agent regressie</title><style>body{margin:0;padding:16px;font-family:sans-serif}*{box-sizing:border-box}:root{--vc-text:#142123;--vc-text-muted:#3a4c50;--vc-surface:#fff;--vc-border:#61757a;--vc-focus:#005b60}${bundle.css}</style></head><body><main><h1>AI-agent</h1><div id="root"></div></main><script>globalThis.initialProposals=${JSON.stringify(initial)};${bundle.js.replace(/<\/script/giu, "<\\/script")}</script></body></html>` }));
  await page.goto(origin + "/__workspace");
  await expect(page.getByLabel("Vraag of opdracht")).toBeVisible();
  return calls;
}

for (const width of [390, 1440]) test(`real agent workspace clarifies, proposes and cancels without implicit writes at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const calls = await mount(page);
  await page.getByLabel("Vraag of opdracht").fill("Verplaats de tweede poster omhoog");
  await page.getByRole("button", { name: "Versturen", exact: true }).click();
  await page.getByRole("button", { name: "Barscherm", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voorstel · nog niets uitgevoerd" })).toBeVisible();
  await expect(page.getByText("Betrokken schermen:", { exact: false })).toContainText("Barscherm, Kantine");
  expect(calls.filter(call => call.name === "decideAgentProposalAction")).toHaveLength(0);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Geannuleerd" })).toBeVisible();
  expect(calls.filter(call => call.name === "decideAgentProposalAction")[0]!.args).toEqual([proposal.id, proposal.plan_hash, false, null]);
});

test("editing blocks stale approval and persists a new exact proposal before keyboard confirmation", async ({ page }) => {
  const calls = await mount(page, [proposal]);
  await page.getByText("Voorstel aanpassen", { exact: true }).click();
  const input = page.getByLabel("Exacte voorstelstappen");
  await input.fill((await input.inputValue()).replace('"up"', '"down"'));
  await expect(page.getByRole("button", { name: "Akkoord en uitvoeren" })).toBeDisabled();
  await page.getByRole("button", { name: "Aangepast voorstel controleren" }).click();
  const approve = page.getByRole("button", { name: "Akkoord en uitvoeren" });
  await expect(approve).toBeEnabled(); await approve.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Alle stappen bevestigd uitgevoerd" })).toBeVisible();
  const decision = calls.filter(call => call.name === "decideAgentProposalAction");
  expect(decision).toHaveLength(1); expect(decision[0]!.args).toEqual(["revised", "b".repeat(64), true, null]);
  await expect(page.getByRole("link", { name: "Open bevestigd resultaat: Clubavond" })).toBeVisible();
});

test("requires informed current risk consent rather than a generic waiver", async ({ page }) => {
  const calls = await mount(page, [proposal], "risk");
  await page.getByRole("button", { name: "Akkoord en uitvoeren" }).click();
  await expect(page.getByText("Barscherm: heartbeat verouderd.", { exact: true })).toBeVisible();
  const resume = page.getByRole("button", { name: "Bevestigde opdracht hervatten" });
  await expect(resume).toBeDisabled();
  await page.getByRole("checkbox", { name: "Ik bevestig uitsluitend deze getoonde risico’s voor deze stap." }).check();
  await resume.dblclick();
  await expect(page.getByRole("heading", { name: "Alle stappen bevestigd uitgevoerd" })).toBeVisible();
  expect(calls.filter(call => call.name === "decideAgentProposalAction").map(call => call.args[3])).toEqual([null, "current-risk-hash"]);
});

test("connection failure preserves composed input and never implies publication", async ({ page }) => {
  const calls = await mount(page, [], "offline");
  await page.getByLabel("Vraag of opdracht").fill("Mijn volledige nog niet verzonden opdracht");
  await page.getByRole("button", { name: "Versturen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("invoer");
  await expect(page.getByLabel("Vraag of opdracht")).toHaveValue("Mijn volledige nog niet verzonden opdracht");
  expect(calls.filter(call => call.name === "decideAgentProposalAction")).toHaveLength(0);
});

test("multiple image transfers remain private and do not imply an approved mutation", async ({ page }) => {
  const calls = await mount(page);
  await page.getByLabel("Bijlagen kiezen").setInputFiles([{ name: "poster.png", mimeType: "image/png", buffer: Buffer.from("synthetic poster transport") }, { name: "sponsorlogo.png", mimeType: "image/png", buffer: Buffer.from("synthetic logo transport") }]);
  await expect(page.getByRole("heading", { name: "poster.png", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "sponsorlogo.png", exact: true })).toBeVisible();
  await expect(page.getByText("Ontvangen · verwerkingsstatus hieronder", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Gereed · Privéconcept", { exact: true })).toHaveCount(2);
  expect(calls.filter(call => call.name === "openAgentConversationAction")).toHaveLength(1);
  expect(calls.filter(call => ["decideAgentProposalAction", "generateAgentImageAction"].includes(call.name))).toHaveLength(0);
});

test("generation requires an explicit paid button and previews fit versus crop in the selected ratio", async ({ page }) => {
  const calls = await mount(page);
  await page.getByText("Afbeelding maken of bewerken", { exact: true }).click();
  await page.getByLabel("Beeldopdracht", { exact: true }).fill("Abstracte clubavondachtergrond zonder tekst of logo");
  await page.getByRole("combobox", { name: "Doelformaat", exact: true }).selectOption("portrait");
  expect(calls.filter(call => call.name === "generateAgentImageAction")).toHaveLength(0);
  await page.getByRole("button", { name: "Genereer voorbeeld (betaald)", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("heading", { name: "Nieuw beeldconcept", exact: true })).toBeVisible();
  const image = page.getByRole("img", { name: "Voorbeeld Nieuw beeldconcept", exact: true });
  await expect(image).toHaveCSS("object-fit", "contain");
  await page.getByRole("combobox", { name: "Voorbeeld passen", exact: true }).selectOption("cover");
  await expect(image).toHaveCSS("object-fit", "cover");
  expect(calls.filter(call => call.name === "generateAgentImageAction")).toHaveLength(1);
  expect(calls.find(call => call.name === "generateAgentImageAction")!.args[0]).toMatchObject({ orientation: "portrait" });
  expect(calls.filter(call => call.name === "decideAgentProposalAction")).toHaveLength(0);
});

test("only actual receipt release and exact selected screens can obtain a player confirmation", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-18T12:00:00Z") });
  const completed = structuredClone(proposal);
  completed.status = "completed"; completed.next_step = 1;
  completed.plan.steps[0]!.operation = "publish";
  completed.plan.steps[0]!.args.screenIds = ["screen-a", "screen-b"];
  completed.plan.steps[0]!.affectedScreens.push({ id: "unrelated-future-screen", name: "Andere programmering" });
  completed.receipts = [{ step: 0, result: { releaseId: "new-release", outcome: "published" }, completedAt: "2026-11-18T12:00:00Z" }];
  const calls = await mount(page, [completed]);
  const status = page.getByRole("region", { name: "Werkelijke playerbevestigingen" });
  await expect(status.getByText("nog geen recente bevestiging van deze release", { exact: false })).toHaveCount(1);
  await expect(status.getByText("deze release recent actief gemeld door Player", { exact: false })).toHaveCount(1);
  expect(calls.find(call => call.name === "readAgentPlayerStatusAction")!.args).toEqual([["screen-a", "screen-b"]]);
  await page.clock.fastForward(8001);
  await expect(status.getByText("deze release recent actief gemeld door Player", { exact: false })).toHaveCount(2);
  expect(calls.filter(call => call.name === "decideAgentProposalAction")).toHaveLength(0);
});

test("a failed attachment read is visible, preserves the conversation and recovers without an unhandled rejection", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const calls = await mount(page, [proposal], "attachment-read-failure");
  await expect(page.getByRole("alert")).toContainText("actuele bijlagestatus");
  await page.getByLabel("Bijlagen kiezen").setInputFiles({ name: "herstel.png", mimeType: "image/png", buffer: Buffer.from("synthetic recovered transfer") });
  await expect(page.getByRole("heading", { name: "herstel.png", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(calls.filter(call => call.name === "openAgentConversationAction")).toHaveLength(0);
  expect(calls.filter(call => call.name === "decideAgentProposalAction")).toHaveLength(0);
  expect(errors).toEqual([]);
});
