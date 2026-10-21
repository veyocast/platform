import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

// Actual route/component/CSS presentation; server reads, Next navigation and
// action transport are controlled. This does not prove live Auth/RLS acceptance.
export const screenFlowOrigin = "http://127.0.0.1:3389";
export const screenFlowId = (n: number) => `24300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let bundle: { js: string; css: string };
export function prepareScreenFlowFixture() {
  const require = createRequire(join(process.cwd(), "package.json"));
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import ScreenPage from'./apps/control/app/(shell)/dashboard/screens/[screenId]/page';import ReleasePage from'./apps/control/app/(shell)/dashboard/releases/[releaseId]/page';const q={};for(const[k,v]of new URLSearchParams(location.search)){q[k]=k in q?[q[k],v]:v}const release=location.pathname.includes('/publications/');const content=await(release?ReleasePage:ScreenPage)({params:Promise.resolve(release?{releaseId:globalThis.fixture.releaseData.release.id}:{screenId:globalThis.fixture.screenData.screen.id}),searchParams:Promise.resolve(q)});function App(){const[portal,setPortal]=useState(null);return <div className='sync-control app-shell' style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main id='control-content'>{content}</main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const link = 'import React from"react";export default function Link({children,...props}){return React.createElement("a",props,children)}';
  const actions = `async function command(kind,value){globalThis.commands.push({kind,input:value instanceof FormData?Array.from(value.entries()):value});const response=await fetch('/__screen_command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(globalThis.commands.at(-1))});const result=await response.json();if(result.href)location.assign(result.href);return result}export const reassignRelease=v=>command('reassign',v);export const restoreReleaseToDraft=v=>command('restore',v);export const saveScreenComposition=v=>command('composition',v);export const saveScreenAutomation=v=>command('automation',v);export const requestScreenAutomationTest=v=>command('automation-test',v);export const deactivateScreen=v=>command('deactivate',v);export const removeScreen=v=>command('remove',v);export const queuePlayerRecoveryCommand=v=>command('recovery',v);export const renamePlayerDevice=v=>command('rename',v);export const requestScreenSyncRetry=v=>command('sync',v);export const revokePlayerDevice=v=>command('revoke',v);export const updateScreen=v=>command('update',v);export const updateScreenGroupMemberships=v=>command('groups',v);`;
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'esm',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-read-navigation-action-transport',setup(b){
    const mock=(path,contents)=>({path,namespace:'controlled',pluginData:{contents}});
    b.onResolve({filter:/^next\\/(link|navigation)$/},a=>mock(a.path,a.path.endsWith('link')?${JSON.stringify(link)}:'export const notFound=()=>{throw Error("Not found")};export const useRouter=()=>({refresh(){},push:href=>location.assign(href)});'));
    b.onResolve({filter:/^node:crypto$/},a=>mock(a.path,'export const randomUUID=()=>crypto.randomUUID();'));
    b.onResolve({filter:/^server-only$/},a=>mock(a.path,''));
    b.onResolve({filter:/control-session$/},a=>mock(a.path,'export async function requireTenantControlSession(){return globalThis.fixture.session}'));
    b.onResolve({filter:/supabase\\/server$/},a=>mock(a.path,'export async function createControlSupabaseClient(){return null}'));
    b.onResolve({filter:/release-preview.server$/},a=>mock(a.path,'export async function loadFrozenReleasePreviews(){return new Map()}'));
    b.onResolve({filter:/screen-composition-data$/},a=>mock(a.path,'export async function loadCompositionWorkspace(){return globalThis.fixture.composition}'));
    b.onResolve({filter:/automation-data$/},a=>mock(a.path,'export{automationCapabilityView}from'+JSON.stringify(process.cwd()+'/apps/control/app/(shell)/dashboard/screens/[screenId]/automation-data.ts')+';export async function loadScreenAutomation(){return globalThis.fixture.automation}'));
    b.onResolve({filter:/\\/data$/},a=>a.importer.endsWith('/screens/[screenId]/page.tsx')?mock('screen-data','export async function loadScreenDetail(){return globalThis.fixture.screenData}'):a.importer.endsWith('/releases/[releaseId]/page.tsx')?mock('release-data','export async function loadReleaseDetail(){return globalThis.fixture.releaseData}'):undefined);
    b.onResolve({filter:/(?:^|\\/)(?:screen-composition-|automation-)?actions$/},a=>mock(a.path,${JSON.stringify(actions)}));
    b.onLoad({filter:/.*/,namespace:'controlled'},a=>({contents:a.pluginData.contents,resolveDir:process.cwd(),loader:'js'}));
  }}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }));
}

export function screenFlowFixture() {
  const id = screenFlowId;
  const release = { id: id(2), playlistId: id(8), playlistName: "Eigen clubprogramma", label: "Eigen clubprogramma · versie 7", version: 7, automatic: false, publishedAt: "2026-10-19T10:00:00Z" };
  const second = { ...release, id: id(9), playlistId: id(10), playlistName: "Eigen entreeprogramma", label: "Eigen entreeprogramma · versie 3", version: 3 };
  const screen = { id: id(3), name: "Eigen kantinescherm", location: "Kantine", orientation: "landscape", status: "active", assignedReleaseId: release.id, assignedPlaylistId: release.playlistId, defaultReleaseId: release.id, defaultPlaylistId: release.playlistId, activeAssignmentSource: "default", activeScheduleId: null, activeTargetSnapshotId: null, resolutionWidth: 1920, resolutionHeight: 1080, createdAt: release.publishedAt };
  const device = { id: id(6), screenId: screen.id, status: "paired", platform: "Android", deviceName: "Eigen Player", activeReleaseId: release.id, desiredReleaseId: release.id, lastSeenAt: "2026-10-19T12:00:00Z", lastErrorCode: null, lastErrorAt: null, capabilities: { supportsLocalSchedule: true }, appVersion: "1.0", pairedAt: release.publishedAt, revokedAt: null, storageUsedBytes: 100, storageQuotaBytes: 1000, syncRetryRequestedAt: null, syncDetail: {} };
  const preflight = { status: "ready", reasons: [], missingBytes: 0 };
  return {
    session: { isLive: true, tenantId: id(1), tenant: "Eigen vereniging", tenantStatus: "active", capabilities: ["tenant.screen.read", "tenant.screen.manage", "tenant.release.read", "tenant.playlist.publish"] },
    screenData: { screen, releases: [release, second], assignableReleases: [release, second], devices: [device], groups: [], heartbeats: [], schedules: [], automation: { enabled: true, label: "Weekschema" }, auditEvents: [], playerCommands: [], syncEvents: [], venueContext: null, error: null as string | null },
    releaseData: { release: { ...release, itemCount: 1, totalBytes: 100, totalDurationSeconds: 10, manifestHash: "a".repeat(64), publishedBy: "Eigen beheerder", notes: null }, screenStates: [{ screen, preflight, activeReleaseId: release.id, desiredReleaseId: release.id, deviceId: device.id, heartbeatAt: device.lastSeenAt, latestPhase: "active" }, { screen: { ...screen, id: id(7), name: "Eigen tweede scherm" }, preflight: { ...preflight }, activeReleaseId: release.id, desiredReleaseId: release.id, deviceId: id(11), heartbeatAt: device.lastSeenAt, latestPhase: "active" }], items: [], assignments: [], comparisonReleases: [], error: null },
    composition: { error: null, drafts: [], playlists: [release, second].map(value => ({ id: value.playlistId, name: value.playlistName, published: true, previewUrl: null })), series: [] },
    automation: { commands: [], events: [], error: null, revision: 4, disclaimerAcceptedAt: null, disclaimerAcceptedBy: null, tenantTimezone: "Europe/Amsterdam", settings: { enabled: true, timezone: "Europe/Amsterdam", scheduleMode: "weekly", periods: [{ id: id(20), weekday: 1, startLocalTime: "08:00", endLocalTime: "23:00", enabled: true }], exceptions: [], startupEnabled: false, localWakeEnabled: false, hdmiCecEnabled: false, keepAwakeEnabled: true, wakeLeadMinutes: 5, restoreAfterReboot: true, offlineExecutionEnabled: true, temporaryOverride: "none", temporaryOverrideUntil: null } }
  };
}
export type ScreenFlowFixture = ReturnType<typeof screenFlowFixture>;

export async function mountScreenFlow(page: Page, data = screenFlowFixture(), path = `/dashboard/screens/${screenFlowId(3)}`) {
  const errors: string[] = [], commands: Array<{ kind: string; input: Array<[string, string]> }> = [], reads: string[] = [];
  let reply: (command: typeof commands[number]) => Record<string, unknown> = () => ({ status: "published", publishedCount: 1, message: "Eigen bevestigde publicatie" });
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-19T12:00:00Z") });
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${screenFlowOrigin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
  });
  await page.route(`${screenFlowOrigin}/__screen_command`, route => { const command = route.request().postDataJSON() as typeof commands[number]; commands.push(command); return route.fulfill({ json: reply(command) }); });
  await page.route(`${screenFlowOrigin}/dashboard/**`, route => {
    if (route.request().method() !== "GET") throw new Error("Unexpected native route mutation");
    reads.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schermflow · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data)};globalThis.commands=[];</script><script type="module">${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(`${screenFlowOrigin}${path}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { errors, commands, reads, respond: (next: typeof reply) => { reply = next; } };
}
