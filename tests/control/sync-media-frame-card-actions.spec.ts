import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mediaFrameDefaultSettings, type MediaFrameCommand } from "../../packages/contracts/src/media-frames";

// Actual card actions and dialog. Only the Next server-action transport/navigation
// is controlled. The key below deliberately matches the real ContentWorkspace caller.
const origin="http://127.0.0.1:3374", require=createRequire(join(process.cwd(),"package.json"));
const compiler=require.resolve("esbuild",{paths:[require.resolve("tsx")]});
let bundle:{js:string;css:string};
test.beforeAll(()=>{
 const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{MediaFrameCardActions}from'./apps/control/app/(shell)/dashboard/content/media-frames/media-frame-archive-actions';function App(){const[portal,setPortal]=useState(null),[props,setProps]=useState(globalThis.fixtureProps);globalThis.replaceFixtureProps=setProps;return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main id="control-content"><h1>Content</h1><article className="vc-content-card"><h2>{props.title}</h2><div className="vc-card-actions"><MediaFrameCardActions key={props.scope+':'+props.identity} {...props}/></div></article></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
 const script=`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',loader:{'.module.css':'local-css','.css':'css'},platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'controlled-boundaries',setup(b){b.onResolve({filter:/media-frame-actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'async function post(path,input,scope){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input,scope})});if(!r.ok)throw Error("Controlled unavailable transport");return r.json()}export const mutateMediaFrameAction=(input,scope)=>post("/__card/mutate",input,scope);export const prepareMediaFrameCopyAction=(input,scope)=>post("/__card/prepare",input,scope);export const readMediaFrameUsageAction=(input,scope)=>post("/__card/usage",input,scope);',loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{refresh:()=>{globalThis.refreshCount=(globalThis.refreshCount||0)+1}}}',loader:'js'}));}}]});const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text,css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Fixture omitted actual JavaScript or CSS');process.stdout.write(JSON.stringify({js,css}));`;
 bundle=JSON.parse(execFileSync(process.execPath,['-e',`(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024}));
});
const tenant="10000000-0000-4000-8000-000000000001",asset="20000000-0000-4000-8000-000000000001",frame="30000000-0000-4000-8000-000000000001",copyFrame="30000000-0000-4000-8000-000000000002";
type Props={scope:string;identity:string;assetId:string;frameId?:string;revision?:number|null;title:string;archived:boolean;canWrite:boolean;canDuplicate:boolean};
type Request={input:MediaFrameCommand;scope:string};
type Hooks={firstCopy?:boolean;dropFirst?:boolean;usageUnavailable?:boolean;prepareUnavailable?:boolean;conflict?:boolean;viewer?:boolean};
const prepared:Extract<MediaFrameCommand,{operation:'create'}>={operation:'create',tenantId:tenant,sourceAssetId:asset,frameId:copyFrame,expectedRevision:0,isPrimary:false,idempotencyKey:'40000000-0000-4000-8000-000000000001',expectedSources:[{role:'media',mediaAssetId:asset,variantId:'50000000-0000-4000-8000-000000000001',checksumSha256:'a'.repeat(64),byteSize:1024}],settings:mediaFrameDefaultSettings({title:'Eigen media (kopie)',kind:'image',durationSeconds:null})};
async function mount(page:Page,hooks:Hooks={}){
 const errors:string[]=[],writes:Request[]=[],prepares:unknown[]=[],reads:unknown[]=[],durableBeforePost:unknown[]=[],receipts=new Map<string,unknown>();
 const state:{props:Props;commits:number;primaryExists:boolean}={props:{scope:`${tenant}:actor-a`,identity:`media:${asset}`,assetId:asset,frameId:hooks.firstCopy?undefined:frame,revision:hooks.firstCopy?null:1,title:'Eigen media',archived:false,canWrite:!hooks.viewer,canDuplicate:true},commits:0,primaryExists:!hooks.firstCopy};
 const css=['tokens/veyocast-design-tokens.css','packages/ui/src/styles.css','apps/control/app/globals.css','apps/control/app/fieldflow.css','apps/control/app/sync-source.css','apps/control/app/sync-adapter.css'].map(path=>readFileSync(path,'utf8').replace(/@import[^;]+;/g,'')).join('\n');
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(`${origin}/__card/prepare`,route=>{prepares.push(route.request().postDataJSON());return route.fulfill({json:hooks.prepareUnavailable?{ok:false,message:'De bron is niet geverifieerd beschikbaar. Er is niets gewijzigd; controleer het bestand.'}:{ok:true,command:prepared}});});
 await page.route(`${origin}/__card/usage`,route=>{reads.push(route.request().postDataJSON());return route.fulfill({json:hooks.usageUnavailable?{ok:false,message:'Het volledige gebruik kan niet worden bevestigd. Er is niets gearchiveerd; probeer opnieuw.'}:{ok:true,draftCount:2,releaseCount:3,screenCount:4}});});
 await page.route(`${origin}/__card/mutate`,async route=>{
  const input=route.request().postDataJSON() as Request;writes.push(input);
  const stored=await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.startsWith('veyocast-content-media-frame-v1:')).map(([key,value])=>({key,command:JSON.parse(value)})));
  durableBeforePost.push(stored);
  let receipt=receipts.get(input.input.idempotencyKey);
  if(!receipt){
   if(hooks.conflict&&writes.length===1)receipt={ok:false,code:'conflict',uncertain:false,message:'Het ontwerp is gewijzigd. Controleer de actuele versie.'};
   else{state.commits++;receipt={ok:true,frameId:input.input.operation==='duplicate'?input.input.newFrameId:input.input.frameId,frameRevision:2,versionId:'70000000-0000-4000-8000-000000000001',versionNumber:1,outcome:input.input.operation==='create'?'created':input.input.operation==='duplicate'?'duplicated':input.input.operation==='restore'?'restored':'archived'};}
   receipts.set(input.input.idempotencyKey,receipt);
  }
  if(hooks.dropFirst&&writes.length===1)return route.abort();
  return route.fulfill({json:receipt});
 });
 await page.route(`${origin}/__card/fixture`,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contentacties · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify(state.props).replace(/</g,'\\u003c')};${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto(`${origin}/__card/fixture`);
 await expect(page.getByRole('heading',{name:'Eigen media',exact:true})).toBeVisible();
 if(!hooks.viewer)await expect(page.getByRole('button',{name:'Eigen media dupliceren',exact:true})).toBeEnabled();
 return{state,errors,writes,prepares,reads,durableBeforePost,replace:async(change:Partial<Props>)=>{state.props={...state.props,...change};await page.evaluate(props=>(globalThis as typeof globalThis&{replaceFixtureProps:(input:Props)=>void}).replaceFixtureProps(props),state.props);}};
}

test('first duplicate prepares a non-primary copy and journals its exact command before POST',async({page})=>{
 const fixture=await mount(page,{firstCopy:true});expect(fixture.state.primaryExists).toBe(false);await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(1);await expect.poll(()=>page.evaluate(()=>(globalThis as typeof globalThis&{refreshCount:number}).refreshCount)).toBe(1);expect(fixture.prepares).toEqual([{input:{tenantId:tenant,mediaAssetId:asset},scope:`${tenant}:actor-a`}]);expect(fixture.writes[0]).toEqual({input:prepared,scope:`${tenant}:actor-a`});expect(fixture.writes[0]!.input).toMatchObject({operation:'create',isPrimary:false,sourceAssetId:asset,frameId:copyFrame});expect(fixture.durableBeforePost[0]).toEqual([{key:`veyocast-content-media-frame-v1:${tenant}:actor-a:media:${asset}`,command:prepared}]);expect(fixture.state.primaryExists).toBe(false);expect(fixture.state.commits).toBe(1);expect(fixture.errors).toEqual([]);
});

test('unknown first-copy response remains resumable when a primary frame appears before reload',async({page})=>{
 const fixture=await mount(page,{firstCopy:true,dropFirst:true});await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect(page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true})).toBeVisible();fixture.state.props={...fixture.state.props,frameId:frame,revision:7};fixture.state.primaryExists=true;await page.reload();await page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(2);await expect(page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true})).toHaveCount(0);expect(fixture.writes[1]).toEqual(fixture.writes[0]);expect(fixture.prepares).toHaveLength(1);expect(fixture.writes[1]!.input.operation).toBe('create');expect(fixture.state.commits).toBe(1);expect(fixture.durableBeforePost[1]).toEqual(fixture.durableBeforePost[0]);expect(fixture.errors).toEqual([]);
});

test('archive reads exact frame usage, waits for confirmation, and cancellation never writes',async({page})=>{
 const fixture=await mount(page);await page.getByRole('button',{name:'Eigen media archiveren',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByText('2 conceptplaylists · 3 publicaties · 4 schermen',{exact:true})).toBeVisible();expect(fixture.reads).toEqual([{input:{tenantId:tenant,frameId:frame},scope:`${tenant}:actor-a`}]);expect(fixture.writes).toHaveLength(0);await dialog.getByRole('button',{name:'Annuleren',exact:true}).click();await expect(dialog).toHaveCount(0);expect(fixture.writes).toHaveLength(0);await page.getByRole('button',{name:'Eigen media archiveren',exact:true}).click();await dialog.getByRole('button',{name:'Archiveren',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(1);expect(fixture.writes[0]!.input).toMatchObject({operation:'archive',tenantId:tenant,frameId:frame,expectedRevision:1});await expect.poll(()=>fixture.durableBeforePost.length).toBe(1);expect(fixture.durableBeforePost[0]).toEqual([{key:`veyocast-content-media-frame-v1:${tenant}:actor-a:media:${asset}`,command:fixture.writes[0]!.input}]);expect(fixture.errors).toEqual([]);
});

test('unknown archive reply replays original archive after archived props appear, never restore',async({page})=>{
 const fixture=await mount(page,{dropFirst:true});await page.getByRole('button',{name:'Eigen media archiveren',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archiveren',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('serverbevestiging ontbreekt');fixture.state.props={...fixture.state.props,archived:true,revision:2};await page.reload();await expect(page.getByRole('button',{name:'Eigen media herstellen',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true}).click();await expect.poll(()=>fixture.writes.length).toBe(2);expect(fixture.writes[1]).toEqual(fixture.writes[0]);expect(fixture.writes[1]!.input).toMatchObject({operation:'archive',expectedRevision:1});expect(fixture.reads).toHaveLength(1);expect(fixture.state.commits).toBe(1);expect(fixture.errors).toEqual([]);
});

test('unavailable usage and copy preparation fail without any mutation',async({page})=>{
 const fixture=await mount(page,{usageUnavailable:true,prepareUnavailable:true});await page.getByRole('button',{name:'Eigen media archiveren',exact:true}).click();await expect(page.getByRole('alert')).toContainText('volledige gebruik');await expect(page.getByRole('dialog')).toHaveCount(0);expect(fixture.writes).toHaveLength(0);await fixture.replace({frameId:undefined,revision:null});await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect(page.getByRole('alert')).toContainText('bron is niet geverifieerd');expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

test('scope-key remount hides other actor pending state and preserves old recovery record',async({page})=>{
 const fixture=await mount(page,{firstCopy:true,dropFirst:true});await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect(page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true})).toBeVisible();await fixture.replace({scope:`${tenant}:actor-b`});await expect(page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Eigen media dupliceren',exact:true})).toBeEnabled();expect(fixture.writes).toHaveLength(1);expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.includes('actor-a')))).toHaveLength(1);await fixture.replace({scope:`${tenant}:actor-a`});await expect(page.getByRole('button',{name:'Dezelfde actie opnieuw bevestigen',exact:true})).toBeVisible();expect(fixture.writes).toHaveLength(1);expect(fixture.errors).toEqual([]);
});

test('storage failure prevents issuing a new card command',async({page})=>{
 const fixture=await mount(page);await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('veyocast-content-media-frame-v1:'))throw Error('Controlled storage unavailable');return original.call(this,key,value);};});await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Er is niets verstuurd');expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

test('viewer cannot start card commands',async({page})=>{
 const fixture=await mount(page,{viewer:true});await expect(page.getByRole('button',{name:'Eigen media dupliceren',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Eigen media archiveren',exact:true})).toBeDisabled();expect(fixture.prepares).toHaveLength(0);expect(fixture.reads).toHaveLength(0);expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

for(const width of [390,1440])test(`card actions and confirmation are accessible with 44px targets at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});const fixture=await mount(page);const actions=page.locator('.vc-card-actions button');expect(await actions.evaluateAll(elements=>elements.every(element=>{const box=element.getBoundingClientRect();return box.width>=44&&box.height>=44;}))).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);await page.getByRole('button',{name:'Eigen media archiveren',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

test('archive dialog returns keyboard focus to its card action after Escape',async({page})=>{
 const fixture=await mount(page),trigger=page.getByRole('button',{name:'Eigen media archiveren',exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();expect(fixture.writes).toHaveLength(0);expect(fixture.errors).toEqual([]);
});

test('saved-frame duplication uses its CAS and restore requires its own explicit confirmation',async({page})=>{
 const fixture=await mount(page);await page.getByRole('button',{name:'Eigen media dupliceren',exact:true}).click();await expect.poll(()=>fixture.durableBeforePost.length).toBe(1);await expect(page.getByRole('button',{name:'Eigen media dupliceren',exact:true})).toBeEnabled();expect(fixture.prepares).toHaveLength(0);expect(fixture.writes[0]!.input).toMatchObject({operation:'duplicate',frameId:frame,expectedRevision:1});const command=fixture.writes[0]!.input;if(command.operation!=='duplicate')throw Error('Expected duplicate command');expect(command.newFrameId).not.toBe(frame);expect(command.newFrameId).toMatch(/^[a-f0-9-]{36}$/);await fixture.replace({archived:true,revision:3});await page.getByRole('button',{name:'Eigen media herstellen',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Media-ontwerp herstellen',exact:true})).toBeVisible();expect(fixture.writes).toHaveLength(1);await page.getByRole('dialog').getByRole('button',{name:'Herstellen',exact:true}).click();await expect.poll(()=>fixture.durableBeforePost.length).toBe(2);expect(fixture.writes[1]!.input).toMatchObject({operation:'restore',frameId:frame,expectedRevision:3});expect(fixture.writes[1]!.input.idempotencyKey).not.toBe(command.idempotencyKey);expect(fixture.errors).toEqual([]);
});
