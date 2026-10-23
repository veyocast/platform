import{execFileSync}from'node:child_process';
import{createRequire}from'node:module';
import{readFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';
import{test,expect,chromium,type Page}from'@playwright/test';
test.use({launchOptions:{executablePath:chromium.executablePath(),args:['--disable-dev-shm-usage','--no-sandbox','--num-raster-threads=1']}});
import{syncSlideRendererAssets,syncSlidePresentationSchema,type SyncSlidePresentation,type SyncContentFamily}from'@veyocast/contracts';
import{selectSyncOnzeTrotsVisitors}from'@veyocast/content-templates/sync-slide-static-view';
import{createSyncStudioDocument}from'@veyocast/studio';
import{createSyncTemplatePreview}from'../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import{syncSlideCss}from'../../packages/content-templates/src/sync-slide-styles';
const origin='http://127.0.0.1:3388',require=createRequire(join(process.cwd(),'package.json'));
let bundle:string;
test.beforeAll(()=>{
 const compiler=require.resolve('esbuild',{paths:[require.resolve('tsx')]});
 const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SyncStudioMedia}from'./apps/player/app/_components/sync-studio-media';import{measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout,projectSyncOnzeTrotsMotion,applySyncOnzeTrotsMotion}from'@veyocast/content-templates/sync-slide-static-view';
 async function main(){const props=globalThis.fixture,item=props.item;item.syncSystemAssetUrls={};for(const asset of props.assets){const response=await fetch(asset.path);const bytes=await response.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(!response.ok||hash!==asset.sha256||bytes.byteLength!==asset.bytes)throw Error('Fixture asset integrity');item.syncSystemAssetUrls[asset.path]=URL.createObjectURL(new Blob([bytes],{type:asset.mimeType}));}if(props.brokenFont){const font=props.assets.find(asset=>asset.mimeType.startsWith('font/'));item.syncSystemAssetUrls[font.path]=URL.createObjectURL(new Blob([new Uint8Array([0])],{type:font.mimeType}));}if(props.unsupported){const original=CSS.supports.bind(CSS);CSS.supports=(key,value)=>key==='position'&&value==='sticky'?false:original(key,value);}globalThis.ready=[];globalThis.sceneFrame=(elapsed,flags)=>applySyncOnzeTrotsMotion(projectSyncOnzeTrotsMotion(elapsed,measureSyncOnzeTrotsLayout(),item.syncStudioPresentation.visual.scrollSpeed,false,{panelCount:measureSyncOnzeTrotsV9Layout(),mode:item.syncStudioPresentation.visual.mode,entranceAllowed:true,...flags}));globalThis.seek=elapsed=>applySyncOnzeTrotsMotion(projectSyncOnzeTrotsMotion(elapsed,measureSyncOnzeTrotsLayout(),item.syncStudioPresentation.visual.scrollSpeed,false,{panelCount:measureSyncOnzeTrotsV9Layout(),mode:item.syncStudioPresentation.visual.mode,paused:true,introFinished:true,entranceAllowed:true}));
 function App(){const[paused,setPaused]=useState(false);return <><button onClick={()=>setPaused(v=>!v)}>{paused?'Hervatten':'Pauzeren'}</button><div style={{width:props.native?1920:960,height:props.native?1080:540}}><SyncStudioMedia item={item} passive={props.passive} paused={paused} onReady={id=>globalThis.ready.push({id,visible:document.querySelector('.vc-slide-preview')?.getBoundingClientRect().width>0})} fallback={<p id='binary-fallback-selected'>Binaire uitvoer geselecteerd</p>}/></div></>;}createRoot(document.getElementById('root')).render(<App/>);}main().catch(error=>{globalThis.fixtureError=error.message;});`;
 const code=`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/player/node_modules'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}'}});process.stdout.write(result.outputFiles[0].text);`;
 bundle=execFileSync(process.execPath,['-e',`(async()=>{${code}})().catch(error=>{console.error(error.message);process.exitCode=1})`],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:30000});
});
async function mount(page:Page,options:{scale?:number;native?:boolean;own?:'first'|'middle'|'last';passive?:boolean;brokenFont?:boolean;unsupported?:boolean;family?:SyncContentFamily;orientation?:'landscape'|'portrait';mode?:'light'|'dark';count?:number;phase?:'scheduled'|'live'|'paused'|'halftime'|'finished';noOwn?:boolean;seconds?:number}={}){
 const sample=createSyncTemplatePreview(options.family??'standings','sync-onzetrots-v9');if(sample.rendererVersion!=='sync-onzetrots-v9')throw Error('New renderer unavailable');
 const presentation:SyncSlidePresentation=structuredClone(sample),standing=presentation.rich?.standings;
 presentation.orientation=options.orientation??presentation.orientation;
 presentation.visual.mode=options.mode??presentation.visual.mode;
 if(options.scale!==undefined&&presentation.rendererVersion==='sync-onzetrots-v9')presentation.authoring.welcomeScalePercent=options.scale;
 if(options.phase)presentation.rich={...presentation.rich,phase:options.phase};
 if(options.noOwn&&standing)standing.ownTeamId=null;
 if(options.count!==undefined){
  if(standing)standing.rows=standing.rows.slice(0,options.count);
  if(presentation.rich?.visitorsSelection)presentation.rich.fixtures=selectSyncOnzeTrotsVisitors(presentation.rich.fixtures??[],presentation.rich.visitorsSelection).slice(0,options.count);
  const items=presentation.rich?.birthdays??presentation.rich?.activities;
  if(items){const expanded=Array.from({length:options.count},(_,index)=>({...items[index%items.length]!,id:`case-${index}`}));if(presentation.rich?.birthdays)presentation.rich.birthdays=expanded as typeof presentation.rich.birthdays;else if(presentation.rich?.activities)presentation.rich.activities=expanded as typeof presentation.rich.activities;}
 }
 if(standing&&options.own&&options.own!=='middle'){
  const own=standing.rows.find(row=>row.teamId===standing.ownTeamId)!,others=standing.rows.filter(row=>row!==own);
  standing.rows=(options.own==='first'?[own,...others]:[...others,own]).map((row,index)=>({...row,position:index+1}));
 }
 const document=createSyncStudioDocument(presentation,options.seconds),assets=syncSlideRendererAssets(presentation);
 const item={id:'28500000-0000-4000-8000-000000000001',kind:'video',durationSeconds:document.motion.durationMs/1000,syncStudioPresentation:syncSlidePresentationSchema.parse(presentation),syncStudioDurationMs:document.motion.durationMs,syncStudioAssets:{},fitMode:'contain',source:{checksumSha256:'a'.repeat(64),bytes:100,mimeType:'video/mp4',url:'/complete.mp4'}};
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(origin+'/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:bundle});
  const asset=assets.find(asset=>asset.path===path);if(asset)return route.fulfill({contentType:asset.mimeType,body:readFileSync(join(process.cwd(),'apps/player/public',path))});
  if(path==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang='nl'><head><meta charset='utf-8'><style>body{margin:0;font:15px Arial;line-height:1.6;letter-spacing:1px}</style></head><body><div id='root'></div><script>globalThis.fixture=${JSON.stringify({item,assets,...options})}</script><script src='/fixture.js'></script></body></html>`});
  return route.abort();
 });
 await page.goto(origin);return{presentation,errors};
}
async function ready(page:Page){await expect.poll(()=>page.evaluate(()=>(globalThis as typeof globalThis&{ready:unknown[]}).ready?.length??0)).toBe(1);await expect(page.locator('[data-ot-rank-list]')).toBeVisible();}
async function position(page:Page){return page.locator('[data-ot-rank-list]').evaluate(list=>{const root=list as HTMLElement,own=root.querySelector<HTMLElement>('.own')!,bounds=root.getBoundingClientRect(),row=own.getBoundingClientRect();return{scroll:root.scrollTop,range:root.scrollHeight-root.clientHeight,ownCount:root.querySelectorAll('.own').length,ownY:(row.top-bounds.top)/(bounds.height/root.clientHeight),rowHeight:own.offsetHeight,viewport:root.clientHeight};});}
test('an approved canvas remains pixel-identical when a legacy Sync stylesheet loads on the same page',async({page})=>{
 const state=await mount(page,{passive:true});await expect(page.locator('[data-ot-rank-list]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 const canvas=page.locator('.ot-approved-frame'),before=await canvas.screenshot();await page.addStyleTag({content:syncSlideCss});await page.evaluate(()=>document.fonts.ready);
 expect(await canvas.screenshot()).toEqual(before);expect(state.errors).toEqual([]);
});
for(const own of ['first','middle','last']as const)test(`one real controlled own row remains pinned at both boundaries (${own})`,async({page})=>{
 const result=await mount(page,{own,passive:true});await expect(page.locator('[data-ot-rank-list]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 for(const elapsed of [0,20000,38000]){
  await page.evaluate(time=>(globalThis as typeof globalThis&{seek:(time:number)=>void}).seek(time),elapsed);
  const actual=await position(page);expect(actual.ownCount).toBe(1);expect(actual.ownY).toBeGreaterThanOrEqual(-0.001);expect(actual.ownY+actual.rowHeight).toBeLessThanOrEqual(actual.viewport+0.001);
  if(elapsed===20000&&own!=='last')expect(actual.ownY).toBeCloseTo(0,2);
 }
 expect(result.errors).toEqual([]);
});
test('the actual Player clock moves, pauses, resumes and accrues no hidden time',async({page})=>{
 const result=await mount(page);await ready(page);
 await expect.poll(async()=>(await position(page)).scroll,{timeout:7000}).toBeGreaterThan(10);
 await page.getByRole('button',{name:'Pauzeren',exact:true}).click();const paused=await position(page);await page.waitForTimeout(300);expect((await position(page)).scroll).toBe(paused.scroll);
 await page.getByRole('button',{name:'Hervatten',exact:true}).click();await expect.poll(async()=>(await position(page)).scroll).toBeGreaterThan(paused.scroll);
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{value:true,configurable:true}));await page.waitForTimeout(50);const hidden=await position(page);await page.waitForTimeout(300);expect((await position(page)).scroll).toBe(hidden.scroll);
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{value:false,configurable:true}));await expect.poll(async()=>(await position(page)).scroll).toBeGreaterThan(hidden.scroll);expect(result.errors).toEqual([]);
});
test('reduced motion keeps the complete DOM collection still and readable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const result=await mount(page);await ready(page);await page.waitForTimeout(3000);expect((await position(page)).scroll).toBe(0);await expect(page.locator('.rank-row')).toHaveCount(14);expect(result.errors).toEqual([]);
});
test('a failed approved font decoder retains the binary path without a visible-frame acknowledgment',async({page})=>{
 await mount(page,{brokenFont:true});await expect(page.locator('#binary-fallback-selected')).toBeVisible();await expect(page.locator('.vc-slide-preview')).toHaveCount(0);expect(await page.evaluate(()=>(globalThis as typeof globalThis&{ready:unknown[]}).ready)).toEqual([]);
});
test('an older sticky/SVG capability profile selects its existing binary without exposing the new DOM',async({page})=>{
 await mount(page,{unsupported:true});await expect(page.locator('#binary-fallback-selected')).toBeVisible();await expect(page.locator('[data-renderer="sync-onzetrots-v9"]')).toHaveCount(0);expect(await page.evaluate(()=>(globalThis as typeof globalThis&{ready:unknown[]}).ready)).toEqual([]);
});

for(const family of ['birthdays','activities','agenda']as const)for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)test(`${family}/${orientation}/${mode}: every 0–6 selection retains six identical fixed slots`,async({page})=>{
 let baseline:Array<{x:number;y:number;width:number;height:number}>|undefined;
 for(let count=0;count<=6;count++){
  const state=await mount(page,{family,orientation,mode,count,passive:true});
  const grid=page.locator('.fixed-six-grid');await expect(grid).toHaveAttribute('data-filled-count',String(count));
  await expect(grid.locator(':scope > *')).toHaveCount(6);await expect(grid.locator(':scope > article')).toHaveCount(count);
  await expect(grid.locator('.empty-grid-slot')).toHaveCount(6-count);
  const measured=await grid.locator(':scope > *').evaluateAll(elements=>elements.map(element=>{const b=element.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}));
  if(!baseline)baseline=measured;else expect(measured).toEqual(baseline);
  const empty=await grid.locator('.empty-grid-slot').evaluateAll(elements=>elements.every(element=>element.textContent===''&&element.childElementCount===0&&getComputedStyle(element).visibility==='hidden'&&element.getAttribute('aria-hidden')==='true'));
  expect(empty).toBe(true);expect(measured[1]!.x).toBeGreaterThan(measured[0]!.x);expect(measured[2]!.x).toBeGreaterThan(measured[1]!.x);expect(measured[3]!.y).toBeGreaterThan(measured[0]!.y);expect(measured.every(b=>b.width>0&&b.height>0)).toBe(true);expect(state.errors).toEqual([]);
 }
});
for(const orientation of ['landscape','portrait']as const)test(`welcome 0–4 uses the approved ${orientation} card geometry and real visitor crests`,async({page})=>{
 for(let count=0;count<=4;count++){
  const state=await mount(page,{family:'welcome',orientation,count,passive:true});
  if(!count){await expect(page.locator('.welcome-empty')).toBeVisible();await expect(page.locator('.welcome-card')).toHaveCount(0);continue;}
  const cards=page.locator('.welcome-card');await expect(cards).toHaveCount(count);
  const bounds=await cards.evaluateAll(elements=>elements.map(element=>{const b=element.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,logicalHeight:element.clientHeight,contentBottom:Math.max(...[...element.querySelectorAll('.welcome-card-top,.visitor-spotlight,.fixture-caption,.welcome-logistics')].map(child=>child.getBoundingClientRect().bottom))};}));
  for(const b of bounds){expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.contentBottom).toBeLessThanOrEqual(b.y+b.height);}
  if(orientation==='portrait'){expect(new Set(bounds.map(b=>b.x)).size).toBe(1);expect(new Set(bounds.map(b=>b.logicalHeight)).size).toBe(1);}
  else if(count===2)expect(bounds[0]!.y).toBe(bounds[1]!.y);
  else if(count===3)expect(bounds[0]!.height).toBeGreaterThan(bounds[1]!.height);
  else if(count===4){expect(bounds[0]!.y).toBe(bounds[1]!.y);expect(bounds[2]!.y).toBe(bounds[3]!.y);}
  await expect(cards.locator('.visitor-spotlight .container-club-logo')).toHaveCount(0);expect(state.errors).toEqual([]);
 }
});
for(const orientation of ['landscape','portrait']as const)test(`the actual phase chip precedes and stays above the score in ${orientation}`,async({page})=>{
 for(const phase of ['scheduled','live','paused','halftime','finished']as const){
  const state=await mount(page,{family:'scoreboard',orientation,phase,passive:true});
  const chip=page.locator('[data-ot-clock]');await expect(chip).toBeVisible();
  const geometry=await chip.evaluate(element=>{const score=element.parentElement!.querySelector('[data-ot-score]')!,a=element.getBoundingClientRect(),b=score.getBoundingClientRect();return{bottom:a.bottom,top:b.top,before:Boolean(element.compareDocumentPosition(score)&Node.DOCUMENT_POSITION_FOLLOWING)};});
  expect(geometry.before).toBe(true);expect(geometry.bottom).toBeLessThan(geometry.top);
  await expect(chip).toContainText({scheduled:'63:24',live:'LIVE',paused:'GEPAUZEERD',halftime:'RUST',finished:'EINDSTAND'}[phase]);expect(state.errors).toEqual([]);
 }
});
test('short standings stay still and an absent own row is reported without fabricated or duplicate rows',async({page})=>{
 for(const count of [0,1,3,14]){
  const state=await mount(page,{count,noOwn:true,passive:true});await expect(page.locator('[data-ot-rank-list]')).toBeVisible();await expect(page.locator('.rank-row')).toHaveCount(count);await expect(page.locator('.rank-row.own')).toHaveCount(0);
  await expect(page.locator('.rank-status')).toHaveText('Geen eigen rij beschikbaar');await expect(page.locator('[data-ot-rank-list]')).toHaveAttribute('aria-label','Volledige ranglijst; geen eigen rij beschikbaar');
  await page.evaluate(()=>(globalThis as typeof globalThis&{seek:(time:number)=>void}).seek(20000));
  const scroll=await page.locator('[data-ot-rank-list]').evaluate(element=>element.scrollTop);if(count<7)expect(scroll).toBe(0);else expect(scroll).toBeGreaterThan(0);expect(state.errors).toEqual([]);
 }
});
for(const family of ['birthdays','activities','agenda']as const)test(`${family}: the seventh real record reaches a second page with five empty slots`,async({page})=>{
 const state=await mount(page,{family,count:7,seconds:3});await expect.poll(()=>page.evaluate(()=>(globalThis as typeof globalThis&{ready:unknown[]}).ready?.length??0)).toBe(1);
 await expect(page.locator('.fixed-six-grid')).toHaveAttribute('data-filled-count','1',{timeout:7000});await expect(page.locator('.empty-grid-slot')).toHaveCount(5);expect(state.errors).toEqual([]);
});

test('the actual Worker and Player share native entrance pixels at equal elapsed times',async({page},info)=>{
 await page.setViewportSize({width:1920,height:1140});
 const state=await mount(page,{family:'free',native:true,passive:true});
 await page.addStyleTag({content:'button{position:fixed;top:1100px;left:0}'});
 const canvas=page.locator('.ot-approved-frame');await expect(canvas).toBeVisible();
 await page.evaluate(async()=>{await document.fonts.load('400 16px OTRubikDistressed');await document.fonts.ready;});
 const directory=info.outputPath('worker-intro');
 execFileSync('pnpm',['exec','tsx','tests/helpers/sync-onzetrots-v9-intro-capture.mts',directory],{cwd:process.cwd(),timeout:45000,stdio:'pipe'});
 const sharp=require(require.resolve('sharp',{paths:[process.cwd()+'/apps/media-worker/node_modules']}));
 for(const elapsed of [425,1575,2425,3500]){
  await page.evaluate(time=>(globalThis as typeof globalThis&{sceneFrame:(time:number,flags:{paused:boolean;introFinished:boolean})=>void}).sceneFrame(time,{paused:false,introFinished:false}),elapsed);
  const png=await canvas.screenshot();writeFileSync(join(directory,`dom-${elapsed}.png`),png);
  const dom=await sharp(png).ensureAlpha().raw().toBuffer(),worker=await sharp(readFileSync(join(directory,`${elapsed}.png`))).ensureAlpha().raw().toBuffer();
  if(!dom.equals(Buffer.from(worker)))console.log('native-difference',elapsed,{dom:dom.length,worker:worker.length,geometry:await canvas.boundingBox(),scene:await page.locator('.screen').evaluate(e=>({style:(e as HTMLElement).style.cssText,bg:getComputedStyle(e,'::before').opacity,scale:getComputedStyle(e,'::before').transform}))});
  expect(dom.equals(Buffer.from(worker)),`native pixels at ${elapsed} ms`).toBe(true);
 }
 expect(state.errors).toEqual([]);
});

for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']as const)test(`welcome scale 100/150/200 fits all 1–4 actual ${orientation}/${mode} compositions`,async({page})=>{
 for(const count of [1,2,3,4])for(const scale of [100,150,200]){
  const state=await mount(page,{family:'welcome',orientation,mode,count,scale,passive:true});
  await expect(page.locator('.welcome-card')).toHaveCount(count);
  await page.evaluate(async()=>{await document.fonts.ready;});
  await page.evaluate(()=>(globalThis as typeof globalThis&{seek:(time:number)=>void}).seek(4000));
  await expect(page.locator('.screen')).toHaveAttribute('data-ot-welcome-scale',String(scale));
  const fits=await page.locator('.visitor-stage').evaluateAll(elements=>elements.map(stage=>{
   const a=stage.getBoundingClientRect(),b=stage.querySelector('.visitor-spotlight')!.getBoundingClientRect();
   return {stage:{left:a.left,top:a.top,right:a.right,bottom:a.bottom},identity:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},within:b.left>=a.left-.01&&b.right<=a.right+.01&&b.top>=a.top-.01&&b.bottom<=a.bottom+.01,scale:Number((stage as HTMLElement).dataset.effectiveScale)};
  }));
  expect(fits).toHaveLength(count);if(fits.some(value=>!value.within||value.scale>scale))console.log({count,scale,fits});expect(fits.every(value=>value.within&&value.scale>0&&value.scale<=scale)).toBe(true);expect(state.errors).toEqual([]);
 }
});


for(const passive of [true,false])test(`a ${passive?'preloaded goal is complete at zero':'paused goal stays complete after resume'}`,async({page})=>{
 const state=await mount(page,{family:'goal',passive});
 if(passive){await expect(page.locator('.screen')).toHaveAttribute('data-ot-elapsed','0');}
 else{
  await expect.poll(()=>page.evaluate(()=>(globalThis as typeof globalThis&{ready:unknown[]}).ready?.length??0)).toBe(1);
  await page.getByRole('button',{name:'Pauzeren',exact:true}).click();
 }
 await expect(page.locator('.goal-scene')).toHaveCSS('opacity','1');
 await expect(page.locator('.goal-word')).toHaveCSS('opacity','1');
 if(!passive){
  await page.getByRole('button',{name:'Hervatten',exact:true}).click();
  await expect(page.locator('.goal-word')).toHaveCSS('opacity','1');
 }
 expect(state.errors).toEqual([]);
});

test('the actual Worker and Player share a complete native goal when paused at zero',async({page},info)=>{
 await page.setViewportSize({width:1920,height:1140});
 const state=await mount(page,{family:'goal',native:true,passive:true});
 await page.addStyleTag({content:'button{position:fixed;top:1100px;left:0}'});
 const canvas=page.locator('.ot-approved-frame');await expect(canvas).toBeVisible();
 await expect(page.locator('.screen')).toHaveAttribute('data-ot-elapsed','0');
 await expect(page.locator('.goal-word')).toHaveCSS('opacity','1');
 await page.evaluate(async()=>{await document.fonts.load('400 16px OTRubikDistressed');await document.fonts.ready;});
 const directory=info.outputPath('worker-goal-paused');
 execFileSync('pnpm',['exec','tsx','tests/helpers/sync-onzetrots-v9-intro-capture.mts',directory,'goal-paused'],{cwd:process.cwd(),timeout:45000,stdio:'pipe'});
 const sharp=require(require.resolve('sharp',{paths:[process.cwd()+'/apps/media-worker/node_modules']}));
 const png=await canvas.screenshot();writeFileSync(join(directory,'dom-0.png'),png);
 const dom=await sharp(png).ensureAlpha().raw().toBuffer(),worker=await sharp(readFileSync(join(directory,'0.png'))).ensureAlpha().raw().toBuffer();
 expect(dom.equals(Buffer.from(worker)),'native paused-goal pixels at 0 ms').toBe(true);
 expect(state.errors).toEqual([]);
});
