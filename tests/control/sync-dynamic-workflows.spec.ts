import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createSyncStudioStarter} from '../../packages/studio/src/sync';
import type {SyncDynamicCommand,SyncDynamicRequest,SyncDynamicConfiguration,SyncContentFamily} from '@veyocast/contracts';
import {syncConnectedAuthoringType} from '../../apps/control/app/(shell)/dashboard/slides/sync-sportlink-binding';

// Actual Source controller/frame with controlled transport. These cases do not
// claim canonical-provider or database acceptance; separate real-service proofs do.
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
 await page.route(origin+'/fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><title>Gekoppeld Source-ontwerp</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify({tenantId:id,slideId:hooks.create?null:id,versionId:hooks.create?null:id,createKey:hooks.create?'owned-menu':undefined,initialRevision:state.revision,initialRequest:state.request,sources:[{id:sourceId,name:'Eigen catalogus',kind:hooks.sportFamily?'sportlink':'manual_products',provider_status:'healthy',last_successful_sync_at:'2026-10-18T06:00:00Z',last_error_code:null}],templates:[{current_published_version_id:id,orientation:'landscape',slug:'actual-template'}],assets:[],error:null}).replace(/</g,'\\u003c')};${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto(origin+'/fixture');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeEnabled();if(!hooks.create)await expect.poll(()=>previews.length).toBeGreaterThan(0);
 return{state,writes,previews,receipts,errors,jobs:()=>jobs};
}
test('opening and previewing bound facts never writes or exposes manual provider fields',async({page})=>{
 const run=await mount(page);await expect(page.locator('.vc-slide-preview').first()).toContainText('Eigen product 1');
 await page.getByRole('button',{name:'Gegevensbron',exact:true}).click();await expect(page.getByLabel('Gekoppelde bron',{exact:true})).toHaveValue(sourceId);
 await expect(page.getByLabel('Rijen · één rij per regel')).toHaveCount(0);await expect(page.getByLabel('Bronregels')).toHaveValue('9');
 expect(run.writes).toEqual([]);expect(run.jobs()).toBe(0);expect(run.errors).toEqual([]);
});
test('a lost save acknowledgement survives reload and recovers its exact old revision and key',async({page})=>{
 const run=await mount(page,{dropSave:true});await page.getByLabel('Ontwerpnaam',{exact:true}).fill('Eigen nieuwe naam');await page.getByRole('button',{name:'Opslaan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('antwoord is verloren');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeDisabled();
 await page.reload();await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('Eigen nieuwe naam');await page.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();
 await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeEnabled();expect(run.writes).toHaveLength(2);expect(run.writes[1]).toEqual(run.writes[0]);expect(run.state.revision).toBe(5);expect(run.receipts.size).toBe(1);expect(run.jobs()).toBe(0);expect((run.state.request.configuration.syncConfiguration as SyncDynamicConfiguration).seed.rows).toEqual([]);expect(run.errors).toEqual([]);
});
test('preparing complete output is explicit and its lost receipt never duplicates the job',async({page})=>{
 const run=await mount(page,{dropPublish:true});await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByRole('button',{name:'Afspeeluitvoer voorbereiden',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('antwoord is verloren');await page.reload();await page.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();
 await expect(page.getByText('De volledige bronuitvoer wordt voorbereid.',{exact:false})).toBeVisible();expect(run.jobs()).toBe(1);expect(run.writes).toHaveLength(2);expect(run.writes[1]).toEqual(run.writes[0]);expect(run.errors).toEqual([]);
});
test('a rejected command retains editable input and no claimed success',async({page})=>{
 const run=await mount(page,{reject:true});await page.getByLabel('Ontwerpnaam',{exact:true}).fill('Bewaarde invoer');await page.getByRole('button',{name:'Opslaan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('geweigerd');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toBeEnabled();await page.reload();await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('Bewaarde invoer');expect(run.receipts.size).toBe(0);expect(run.jobs()).toBe(0);
});
test('a stale draft holds its input until the user explicitly opens the server version',async({page})=>{
 const run=await mount(page,{conflict:true});await page.getByLabel('Ontwerpnaam',{exact:true}).fill('Eigen conflicterende invoer');await page.getByRole('button',{name:'Opslaan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('concept is gewijzigd');await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('Eigen conflicterende invoer');
 await page.getByRole('button',{name:'Serverversie openen',exact:true}).click();await expect(page.getByLabel('Ontwerpnaam',{exact:true})).toHaveValue('Eigen bronontwerp');expect(run.jobs()).toBe(0);
});
test('source failure is explicit and cannot start a prepare job',async({page})=>{
 const run=await mount(page,{failPreview:true});await expect(page.getByText('De bron is nu onbereikbaar.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Instellingen',exact:true}).click();await expect(page.getByRole('button',{name:'Afspeeluitvoer voorbereiden',exact:true})).toBeDisabled();expect(run.writes).toEqual([]);expect(run.errors).toEqual([]);
});
test('connected Source frame remains accessible and fits all five widths',async({page})=>{
 const run=await mount(page);for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);expect(run.writes).toEqual([]);expect(run.errors).toEqual([]);
});
test('a new bound copy requires a real source choice and recovers create before navigating once',async({page})=>{
 const run=await mount(page,{create:true,dropCreate:true});
 await page.route(origin+'/dashboard/slides/'+id,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="nl"><title>Ontwerpstatus</title><body><h1>Voorbereiding bekijken</h1></body></html>'}));
 const create=page.getByRole('button',{name:'Maken en voorbereiden',exact:true});await expect(create).toBeDisabled();expect(run.previews).toEqual([]);expect(run.writes).toEqual([]);
 await page.getByLabel('Gekoppelde bron',{exact:true}).selectOption(sourceId);await expect(create).toBeEnabled();expect(run.jobs()).toBe(0);
 await create.click();await expect(page.getByRole('alert')).toContainText('antwoord is verloren');await page.reload();await page.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();
 await expect(page).toHaveURL(origin+'/dashboard/slides/'+id);expect(run.writes).toHaveLength(2);expect(run.writes[1]).toEqual(run.writes[0]);expect(run.writes[0].action).toBe('create');expect(run.writes[0].slideId).toBeNull();expect(run.jobs()).toBe(1);expect(run.errors).toEqual([]);
});
for(const family of['period-standings','pool-program']as const)test(`${family} requires an authorized team and preserves its exact pool/period context`,async({page})=>{
 const run=await mount(page,{create:true,sportFamily:family});const create=page.getByRole('button',{name:'Maken en voorbereiden',exact:true});
 await page.getByLabel('Gekoppelde bron',{exact:true}).selectOption(sourceId);await expect(page.getByLabel('Team',{exact:true})).toBeEnabled();await expect(create).toBeDisabled();expect(run.previews).toEqual([]);
 await page.getByLabel('Team',{exact:true}).selectOption('team-a');await page.getByLabel('Competitie · Eigen team A',{exact:true}).selectOption('0');await expect(create).toBeEnabled();
 const preview=run.previews.at(-1)!;expect(preview.dataSourceId).toBe(sourceId);expect(preview.configuration.context).toEqual({providerTeamId:'team-a',competitionSelectionMode:'pinned',competitionId:'competition-a',phaseId:'2',poolId:'pool-a',seasonId:'2026-2027'});
 if(family==='pool-program')expect(preview.configuration.blueprintKey).toBe('sportlink.pool_schedule_next_7_days');
 expect(preview.configuration).not.toHaveProperty('sitesConfiguration');expect((preview.configuration.syncConfiguration as SyncDynamicConfiguration).seed.rows).toEqual([]);expect(run.writes).toEqual([]);expect(run.jobs()).toBe(0);
 await page.route(origin+'/dashboard/slides/'+id,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="nl"><title>Voorbereiding</title><body><h1>Voorbereiding bekijken</h1></body></html>'}));
 await create.click();await expect(page).toHaveURL(origin+'/dashboard/slides/'+id);expect(run.writes).toHaveLength(1);expect((run.writes[0].request as SyncDynamicRequest).configuration.context).toEqual(preview.configuration.context);expect(run.jobs()).toBe(1);expect(run.errors).toEqual([]);
});
test('a Source birthday choice uses all 21 days without editable provider facts or a preview write',async({page})=>{
 const run=await mount(page,{create:true,sportFamily:'birthdays'});await page.getByLabel('Gekoppelde bron',{exact:true}).selectOption(sourceId);await page.getByLabel('Verjaardagsperiode',{exact:true}).selectOption('21');await expect(page.getByRole('button',{name:'Maken en voorbereiden',exact:true})).toBeEnabled();
 expect(run.previews.at(-1)!.configuration.birthday).toMatchObject({period:{days:21,mode:'next_21_days'},selection:{teamSelectionMode:'all',selectedTeamIds:[],includeWithoutTeam:true}});expect(run.writes).toEqual([]);expect(run.jobs()).toBe(0);await expect(page.getByLabel('Rijen · één rij per regel')).toHaveCount(0);
 for(const width of[390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);expect(run.errors).toEqual([]);
});
test('unavailable team rights keep a new Source choice recoverable and cannot prepare output',async({page})=>{
 const run=await mount(page,{create:true,sportFamily:'period-standings',optionsFail:true});await page.getByLabel('Gekoppelde bron',{exact:true}).selectOption(sourceId);await expect(page.getByText('De teams en bronrechten konden niet worden bevestigd.',{exact:false})).toBeVisible();await expect(page.getByLabel('Team',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Maken en voorbereiden',exact:true})).toBeDisabled();expect(run.previews).toEqual([]);expect(run.writes).toEqual([]);expect(run.errors).toEqual([]);
});
test('an exact committed Source create recovers even when team options become unavailable',async({page})=>{
 const run=await mount(page,{create:true,sportFamily:'period-standings',dropCreate:true});
 await page.route(origin+'/dashboard/slides/'+id,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="nl"><title>Voorbereiding</title><body><h1>Voorbereiding bekijken</h1></body></html>'}));
 await page.getByLabel('Gekoppelde bron',{exact:true}).selectOption(sourceId);await page.getByLabel('Team',{exact:true}).selectOption('team-a');await expect(page.getByRole('button',{name:'Maken en voorbereiden',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Maken en voorbereiden',exact:true}).click();await expect(page.getByRole('alert')).toContainText('antwoord is verloren');
 await page.route(origin+'/__source/options',route=>route.fulfill({json:{ok:false,error:'De bron is niet meer bereikbaar. Je opgeslagen opdracht blijft behouden.'}}));await page.reload();await expect(page.getByText('De bron is niet meer bereikbaar.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Dezelfde opdracht bevestigen',exact:true}).click();
 await expect(page).toHaveURL(origin+'/dashboard/slides/'+id);expect(run.writes).toHaveLength(2);expect(run.writes[1]).toEqual(run.writes[0]);expect(run.jobs()).toBe(1);expect(run.errors).toEqual([]);
});
