import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {expect,type Page} from "@playwright/test";
import {screenFlowFixture} from "./sync-screen-flow-fixture";

export const screenStatusOrigin="http://127.0.0.1:3396";
export const screenStatusNow=Date.parse("2026-11-09T12:00:00Z");
let bundle:{js:string;css:string};
export function statusFixture(ageMs=0) {
 const base=screenFlowFixture(),{screen,releases,devices}=base.screenData,device=devices[0]!;
 device.lastSeenAt=new Date(screenStatusNow-ageMs).toISOString();
 device.syncDetail={publicationTrace:{releaseId:device.activeReleaseId,firstFrameAt:"2026-11-09T10:00:00Z"}};
 const fleet={assignableReleases:releases,automation:{},devices,error:null,features:{healthView:true,venueTwin:false},floorplans:[],floorplanAssets:[],groups:[],limit:8,releases,screens:[screen],settings:{height:1080,width:1920,orientation:"landscape"},venuePlacements:[],venues:[],zones:[]};
 const overview={auditEvents:[],availability:{audit:true,devices:true,integrations:true,media:true,members:true,playlists:true,screens:true,telemetry:true,tenant:true},devices:[{id:device.id,screen_id:screen.id,status:device.status,active_release_id:device.activeReleaseId,desired_release_id:device.desiredReleaseId,last_seen_at:device.lastSeenAt,last_error_code:null,last_error_at:null,storage_used_bytes:100,storage_quota_bytes:1000,current_sync_detail:device.syncDetail}],heartbeats:[],error:false,integrations:{dynamicSources:[],sportlinkConnections:[]},invitations:[],loadState:"complete",media:[],mediaStorageLimitBytes:1000,memberCount:1,playlistItems:[],playlists:[{id:releases[0]!.playlistId,name:releases[0]!.playlistName,status:"published",updated_at:releases[0]!.publishedAt}],releases:releases.map(r=>({id:r.id,playlist_id:r.playlistId,version:r.version,published_at:r.publishedAt})),screenLimit:8,screens:[{id:screen.id,name:screen.name,location:screen.location,status:screen.status,assigned_release_id:screen.assignedReleaseId,created_at:screen.createdAt}],unavailable:[]};
 return {...base,fleet,overview,sources:[] as unknown[]};
}
export function prepareScreenStatusFixture() {
 const require=createRequire(join(process.cwd(),"package.json")),compiler=require.resolve("esbuild",{paths:[require.resolve("tsx")]});
 const entry=`import React from'react';import{createRoot}from'react-dom/client';import Screens from'./apps/control/app/(shell)/dashboard/screens/screens-page';import Detail from'./apps/control/app/(shell)/dashboard/screens/[screenId]/page';import{SyncOverview}from'./apps/control/app/(shell)/dashboard/sync-overview';const f=globalThis.fixture,q=Object.fromEntries(new URLSearchParams(location.search));async function resolve(node){if(Array.isArray(node))return Promise.all(node.map(resolve));if(!React.isValidElement(node))return node;if(typeof node.type==='function'&&node.type.constructor.name==='AsyncFunction')return resolve(await node.type(node.props));return node.props.children===undefined?node:React.cloneElement(node,{},await resolve(node.props.children))}const node=location.pathname==='/dashboard'?await SyncOverview({data:f.overview,schedules:[],tenant:'Eigen vereniging',userName:'Beheerder',canCreateStudio:false,canManageScreens:false}):location.pathname==='/dashboard/screens'?await Screens({searchParams:Promise.resolve(q)}):await Detail({params:Promise.resolve({screenId:f.screenData.screen.id}),searchParams:Promise.resolve(q)});createRoot(document.getElementById('root')).render(<main className='sync-control px-pages' id='control-content'>{await resolve(node)}</main>);`;
 const actionNames=["createScreen","createScreenOnboarding","claimScreenPairing","updateScreen","updateScreenGroupMemberships","deactivateScreen","removeScreen","renamePlayerDevice","revokePlayerDevice","requestScreenSyncRetry","queuePlayerRecoveryCommand","requestBulkScreenSyncRetry","addBulkScreensToGroup","assignBulkScreenRelease","saveScreenComposition","saveScreenAutomation","requestScreenAutomationTest","createVenue","createVenueFloorplan","createVenueZone","saveVenueScreenPlacement"];
 const mocks:Record<string,string>={
  'next/link':`import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`,
  'next/navigation':`export function notFound(){throw Error('Not found')}export function useRouter(){return{refresh(){},push(href){location.assign(href)}}}`,
  'node:crypto':`export const randomUUID=()=>crypto.randomUUID()`,
  'server-only':'',
  'control-session':`export async function requireTenantControlSession(){return globalThis.fixture.session}`,
  'supabase/server':`export async function createControlSupabaseClient(){return{rpc:async()=>({data:globalThis.fixture.sources,error:null})}}`,
  'release-preview.server':`export async function loadFrozenReleasePreviews(){return new Map()}`,
  'screen-composition-data':`export async function loadCompositionWorkspace(){return globalThis.fixture.composition}`,
  'automation-data':`export async function loadScreenAutomation(){return globalThis.fixture.automation};export function automationCapabilityView(){return{}}`,
 };
 const actions=actionNames.map(name=>`export async function ${name}(){throw Error('Status fixture permits no mutations')}`).join(';');
 const program=`const{build}=require(${JSON.stringify(compiler)});const mocks=${JSON.stringify(mocks)};const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},bundle:true,write:false,outfile:'status.js',platform:'browser',format:'esm',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'authorized-status-fixture',setup(b){const mock=(path,contents)=>({path,namespace:'fixture',pluginData:{contents}});b.onResolve({filter:/.*/},a=>{const suffix=Object.keys(mocks).find(key=>a.path===key||a.path.endsWith('/'+key));if(suffix)return mock(a.path,mocks[suffix]);if(a.path.endsWith('/data')&&a.importer.includes('/screens/'))return mock('fleet','export async function loadScreenFleet(){return globalThis.fixture.fleet};export async function loadScreenDetail(){return globalThis.fixture.screenData}');if(/(?:^|\\/)actions$/.test(a.path)||['screen-composition-actions','automation-actions','venue-actions'].some(name=>a.path.endsWith('/'+name)))return mock(a.path,${JSON.stringify(actions)});});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.pluginData.contents,resolveDir:process.cwd(),loader:'js'}))}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
 bundle=JSON.parse(execFileSync(process.execPath,["-e",`(async()=>{${program}})().catch(e=>{console.error(e);process.exitCode=1})`],{encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024}));
}
export async function mountScreenStatus(page:Page,data:ReturnType<typeof statusFixture>,path="/dashboard/screens") {
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.clock.install({time:new Date(screenStatusNow)});
 await page.clock.setFixedTime(new Date(screenStatusNow));
 const css=["tokens/veyocast-design-tokens.css","packages/ui/src/styles.css","apps/control/app/globals.css","apps/control/app/fieldflow.css","apps/control/app/sync-source.css","apps/control/app/sync-adapter.css"].map(p=>readFileSync(p,"utf8").replace(/@import[^;]+;/g,"")).join("\n");
 await page.route(`${screenStatusOrigin}/assets/*`,route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1)!;if(!/^[a-zA-Z0-9_.-]+$/.test(name))return route.abort();return route.fulfill({body:readFileSync(join(process.cwd(),"apps/control/public/assets",name)),contentType:name.endsWith('woff2')?'font/woff2':'image/svg+xml'})});
 await page.route(`${screenStatusOrigin}/dashboard**`,route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schermstatus · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data)}</script><script type="module">${bundle.js.replace(/<\/script/gi,"<\\/script")}</script></body></html>`}));
 await page.goto(screenStatusOrigin+path,{waitUntil:"domcontentloaded"});await expect(page.getByRole('heading',{level:1})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 return {errors};
}
