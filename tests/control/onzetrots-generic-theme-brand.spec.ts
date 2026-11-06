import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {expect,test,type Page} from '@playwright/test';

const require=createRequire(join(process.cwd(),'package.json'));
let bundle:{js:string;css:string};
const entry=`
import React from 'react';import{createRoot}from'react-dom/client';
import{EditorialArenaRenderer}from'./packages/content-templates/src/editorial-arena-renderer';
import{MenuScene}from'./packages/content-templates/src/menu-scene';
import{LedScoresLiveMatchSlide}from'./apps/player/app/_components/ledscores-match-experience';
import{parseLedScoresLiveMatchConfig}from'./apps/player/app/_lib/ledscores-match-experience';
import{themePresentationFromDynamicData}from'./apps/player/app/_components/player-presentation-theme';
import{freezeThemePresentation,themeCatalog}from'./packages/content-templates/src/theme-catalog';
const root=createRoot(document.getElementById('root'));
window.show=({kind='editorial',theme='onzetrots-tv',mode='light',orientation='landscape'})=>{
 const themePresentation=freezeThemePresentation({instant:'2026-09-09T08:00:00.000Z',timezone:'UTC',appearance:{schemaVersion:1,surfaces:{clubLogoBackground:'#ffffff',homeLogoBackground:'#ffffff'},typography:{baseScale:1,bodyFontRef:'vc-source-serif-4-v1',displayFontRef:'vc-anton-v1',sportScale:1}},selection:{accent:'#FF5C20',categoryOverrides:[],modePolicy:{kind:'fixed',mode},ref:{catalog:'v2',id:theme,version:themeCatalog[theme].version},support:null}});
 const payload={schemaVersion:1,slideType:'news',orientation,snapshotHash:'a'.repeat(64),snapshotId:'00000000-0000-4000-8000-000000000101',templateVersionId:'00000000-0000-4000-8000-000000000102',templateSlug:'editorial-arena-news-landscape',data:{themePresentation,brand:{primaryColor:'#FF5C20',clubName:'Eigen club'},news:{title:'Clubnieuws',articles:[{title:'Samen langs de lijn',intro:'Onze vrijwilligers maken het mogelijk.',sourceName:'Clubnieuws'}]}}};
 const document={schemaVersion:'menu-document.v2',id:'menu-1',tenantId:'tenant-1',title:'Onze clubkantine',createdAt:'2026-09-09T08:00:00Z',updatedAt:'2026-09-09T08:00:00Z',revision:1,assets:[],theme:{themeId:theme,themeVersion:themeCatalog[theme].version,mode,brand:{accent:'#FF5C20'}},pages:[{id:'page-1',order:0,blocks:[{id:'category-1',type:'category',order:0,layout:{landscape:{x:96,y:248,w:846,h:704,rotation:0},portrait:{x:72,y:348,w:936,h:1388,rotation:0}},source:{source:'manual',sourceCategoryId:'dranken',sourceName:'Dranken'},productNodes:[{id:'coffee',kind:'product',order:0,productRef:{source:'manual',productId:'coffee'},snapshotFallback:{available:true,name:'Clubkoffie',price:{amountMinor:250,currency:'EUR',taxMode:'inclusive'}}}]}]}]};
 const livePayload={...payload,slideType:'ledscores_live_match',templateSlug:'ledscores-live-match-landscape',data:{themePresentation,type:'ledscores_live_match',liveMatch:{connectionId:'11111111-1111-4111-8111-111111111111',connectionName:'Onze club live',configuration:{outsideMatchBehavior:'last_known',showClock:true,showStatus:true,showTimeline:true,template:'match_center',timelineLimit:5},state:{schemaVersion:1,connectionId:'11111111-1111-4111-8111-111111111111',matchKey:'match-1',stateRevision:'4',sequence:4,status:'live',home:{name:'Thuisclub',score:2,logoUrl:null},away:{name:'Bezoekers',score:1,logoUrl:null},clock:{anchorAt:'2026-08-31T18:00:00.000Z',anchorSeconds:55,direction:'up',maxSeconds:5400,running:true},periodLabel:'Eerste helft',sourceUpdatedAt:'2026-08-31T18:00:00.000Z',staleAfter:'2026-08-31T18:01:00.000Z',timeline:[]}}}};
 window.currentInput=kind==='live'?livePayload:kind==='editorial'?payload:document;window.savedInput=JSON.stringify(window.currentInput);window.readyCount=0;
 root.render(kind==='live'?<LedScoresLiveMatchSlide key={kind+theme+mode+orientation} config={parseLedScoresLiveMatchConfig(livePayload.data)} state={parseLedScoresLiveMatchConfig(livePayload.data).fallbackState} theme={themePresentationFromDynamicData(livePayload.data)} orientation={orientation} onReady={()=>window.readyCount++}/>:kind==='editorial'?<EditorialArenaRenderer key={kind+theme+mode+orientation} item={{id:'item-1',title:'Nieuws',durationSeconds:10,dynamicTemplate:payload}} onReady={()=>window.readyCount++}/>:<MenuScene key={kind+theme+mode+orientation} document={document} assets={{}} orientation={orientation} onReady={()=>window.readyCount++}/>);
};`;

test.beforeAll(()=>{
 const compiler=require.resolve('esbuild',{paths:[require.resolve('tsx')]});
 const script=`const{buildSync}=require(${JSON.stringify(compiler)});const r=buildSync({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual',platform:'browser',format:'iife',jsx:'automatic',loader:{'.woff2':'dataurl'},nodePaths:[process.cwd()+'/apps/control/node_modules'],define:{'process.env.NODE_ENV':'"production"'}});process.stdout.write(JSON.stringify({js:r.outputFiles.find(f=>f.path.endsWith('.js')).text,css:r.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
 bundle=JSON.parse(execFileSync(process.execPath,['-e',script],{encoding:'utf8',maxBuffer:32*1024*1024}));
});
async function mount(page:Page,brokenFont=false){
 await page.route('**/__generic-brand',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}${bundle.css}</style><div id="root"></div><script>${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></html>`}));
 await page.route('**/onzetrots-approved-v1/assets/fonts/club-font-9.ttf',route=>route.fulfill({contentType:'font/ttf',body:brokenFont?Buffer.from('invalid mandatory font'):readFileSync(join(process.cwd(),'apps/player/public/onzetrots-approved-v1/assets/fonts/club-font-9.ttf'))}));
 await page.goto('http://127.0.0.1:3343/__generic-brand');
}
for(const kind of ['editorial','menu'])for(const orientation of ['landscape','portrait']as const)for(const mode of ['light','dark']){
 test(`generic saved ${kind}/${orientation}/${mode} uses the actual Marker header and exact primary`,async({page})=>{
  await page.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});await mount(page);await page.evaluate(value=>Reflect.get(window,'show')(value),{kind,orientation,mode});
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'readyCount'))).toBe(1);
  const root=page.locator('[data-theme-id="onzetrots-tv"]').first(),header=root.locator('h1').first();await expect(header).toBeVisible();await expect(header).toHaveCSS('font-weight','400');expect(await header.evaluate(element=>getComputedStyle(element).fontFamily)).toContain('OTMarker');
  expect(await root.evaluate(element=>getComputedStyle(element).getPropertyValue('--vc-theme-accent').trim())).toBe('#03438A');expect(await root.evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain('OTMarker');
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const{root:dom}=await cdp.send('DOM.getDocument');const{nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'[data-theme-id="onzetrots-tv"] h1'});const{fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==='PermanentMarker-Regular')).toBe(true);await cdp.detach();
  if(kind==='editorial')expect(await root.evaluate(element=>getComputedStyle(element).fontFamily)).toContain('Source Serif 4');
  expect(await page.evaluate(()=>JSON.stringify(Reflect.get(window,'currentInput'))===Reflect.get(window,'savedInput'))).toBe(true);
 });
}
test('generic FieldFlow keeps its saved display and body fonts and accent',async({page})=>{
 await mount(page);await page.evaluate(()=>Reflect.get(window,'show')({kind:'editorial',theme:'fieldflow'}));await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'readyCount'))).toBe(1);
 const root=page.locator('[data-theme-id="fieldflow"]');expect(await root.locator('h1').first().evaluate(element=>getComputedStyle(element).fontFamily)).toContain('Anton');expect(await root.evaluate(element=>getComputedStyle(element).fontFamily)).toContain('Source Serif 4');expect(await root.evaluate(element=>getComputedStyle(element).getPropertyValue('--vc-theme-accent').trim())).toBe('#FF5C20');
});
test('generic Player and capture readiness cannot acknowledge an undecodable required header face',async({page})=>{
 await mount(page,true);await page.evaluate(()=>Reflect.get(window,'show')({}));await page.locator('[data-theme-id="onzetrots-tv"] h1').first().waitFor();await page.waitForTimeout(250);expect(await page.evaluate(()=>Reflect.get(window,'readyCount'))).toBe(0);
});

for(const orientation of ['landscape','portrait']as const){
 test(`generic OnzeTrots live match/${orientation} uses loaded Marker and canonical primary without Sites`,async({page})=>{
  await mount(page);await page.evaluate(value=>Reflect.get(window,'show')(value),{kind:'live',orientation});await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'readyCount'))).toBe(1);
  const root=page.getByTestId('ledscores-live-match-slide'),header=root.locator('h1');await expect(header).toHaveCSS('font-weight','400');expect(await header.evaluate(element=>getComputedStyle(element).fontFamily)).toContain('OTMarker');expect(await header.evaluate(element=>getComputedStyle(element).fontSynthesis)).toBe('none');expect(await root.evaluate(element=>getComputedStyle(element).getPropertyValue('--live-accent').trim())).toBe('#03438A');await expect(root).toContainText('Thuisclub');await expect(root).toContainText('Bezoekers');expect(await root.evaluate(element=>getComputedStyle(element).fontFamily)).not.toContain('OTMarker');
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const{root:dom}=await cdp.send('DOM.getDocument');const{nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'[data-testid="ledscores-live-match-slide"] h1'});const{fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==='PermanentMarker-Regular')).toBe(true);await cdp.detach();expect(await page.evaluate(()=>JSON.stringify(Reflect.get(window,'currentInput'))===Reflect.get(window,'savedInput'))).toBe(true);
 });
}
test('generic OnzeTrots live match cannot acknowledge a corrupt mandatory header font',async({page})=>{
 await mount(page,true);await page.evaluate(()=>Reflect.get(window,'show')({kind:'live'}));await page.getByTestId('ledscores-live-match-slide').waitFor();await page.waitForTimeout(250);expect(await page.evaluate(()=>Reflect.get(window,'readyCount'))).toBe(0);
});
